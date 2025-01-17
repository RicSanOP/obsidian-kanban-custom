import classcat from 'classcat';
import { getLinkpath, moment } from 'obsidian';
import Preact from 'preact/compat';

import { t } from 'src/lang/helpers';
import { StateManager } from 'src/StateManager';
import { parsePeriod } from 'src/helpers';

import { c } from '../helpers';
import { DateColorKey, Item } from '../types';

export function getRelativeDate(date: moment.Moment, time: moment.Moment) {
  if (time) {
    return time.from(moment());
  }

  const today = moment().startOf('day');

  if (today.isSame(date, 'day')) {
    return t('today');
  }

  const diff = date.diff(today, 'day');

  if (diff === -1) {
    return t('yesterday');
  }

  if (diff === 1) {
    return t('tomorrow');
  }

  return date.from(today);
}

interface DateProps {
  item: Item;
  stateManager: StateManager;
}

export function RelativeDate({ item, stateManager }: DateProps) {
  const shouldShowRelativeDate = stateManager.useSetting('show-relative-date');

  if (!shouldShowRelativeDate || !item.data.metadata.date) {
    return null;
  }

  const relativeDate = getRelativeDate(
    item.data.metadata.date,
    item.data.metadata.time
  );

  return (
    <span className={c('item-metadata-date-relative')}>{relativeDate}</span>
  );
}

interface DateAndTimeProps {
  onEditDate?: Preact.JSX.MouseEventHandler<HTMLSpanElement>;
  onEditTime?: Preact.JSX.MouseEventHandler<HTMLSpanElement>;
  filePath: string;
  getDateColor: (date: moment.Moment) => DateColorKey;
}

export function DateAndTime({
  item,
  stateManager,
  filePath,
  onEditDate,
  onEditTime,
  getDateColor,
}: DateProps & DateAndTimeProps) {
  const hideDateDisplay = stateManager.useSetting('hide-date-display');
  const dateFormat = stateManager.useSetting('date-format');
  const timeFormat = stateManager.useSetting('time-format');
  const dateDisplayFormat = stateManager.useSetting('date-display-format');
  const shouldLinkDate = stateManager.useSetting('link-date-to-daily-note');
  // @DONE incorporate period in dates flag
  const periodInDates = stateManager.useSetting('periods-in-dates');
  
  const dateColor = Preact.useMemo(() => {
    if (!item.data.metadata.date) return null;
    return getDateColor(item.data.metadata.date);
  }, [item.data.metadata.date, getDateColor]);
  
  if (hideDateDisplay || !item.data.metadata.date) return null;

  // @DONE alter date string representations if period setting is on
  /* there is a general inconsistency with the period in dates feature implementation
  which is that the metadata information on periodUnit and periodFormat is somehow lost
  along the way whenever there is an unresolved link that is changed */
  if (periodInDates) {
    ({
      period: item.data.metadata.date,
      unit: item.data.metadata.periodUnit,
      format: item.data.metadata.periodFormat,
    } = parsePeriod(item.data.metadata.dateStr))
    var dateStr = item.data.metadata.date.format(item.data.metadata.periodFormat)
    var dateDisplayStr = item.data.metadata.date.format(item.data.metadata.periodFormat)
  } else {
    var dateStr = item.data.metadata.date.format(dateFormat);
    if (!dateStr) return null;
    var dateDisplayStr = item.data.metadata.date.format(dateDisplayFormat);
  }
  const hasTime = !!item.data.metadata.time;
  const timeDisplayStr = !hasTime
    ? null
    : item.data.metadata.time.format(timeFormat);

  const datePath = dateStr ? getLinkpath(dateStr) : null;
  const isResolved = dateStr
    ? stateManager.app.metadataCache.getFirstLinkpathDest(datePath, filePath)
    : null;
  const date =
    datePath && shouldLinkDate ? (
      <a
        href={datePath}
        data-href={datePath}
        className={`internal-link ${isResolved ? '' : 'is-unresolved'}`}
        target="blank"
        rel="noopener"
      >
        {dateDisplayStr}
      </a>
    ) : (
      dateDisplayStr
    );

  const dateProps: HTMLAttributes<HTMLSpanElement> = {};

  if (!shouldLinkDate) {
    dateProps['aria-label'] = t('Change date');
    dateProps.onClick = onEditDate;
  }

  return (
    <span
      style={
        dateColor && {
          '--date-color': dateColor.color,
          '--date-background-color': dateColor.backgroundColor,
        }
      }
      className={classcat([
        c('item-metadata-date-wrapper'),
        {
          'has-background': !!dateColor?.backgroundColor,
        },
      ])}
    >
      <span
        {...dateProps}
        className={`${c('item-metadata-date')} ${
          !shouldLinkDate ? 'is-button' : ''
        }`}
      >
        {date}
      </span>{' '}
      {hasTime && (
        <span
          onClick={onEditTime}
          className={`${c('item-metadata-time')} is-button`}
          aria-label={t('Change time')}
        >
          {timeDisplayStr}
        </span>
      )}
    </span>
  );
}
