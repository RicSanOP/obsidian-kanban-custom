import { App, TFile } from 'obsidian';
import { moment } from 'obsidian';
import {
  getDailyNoteSettings,
  getDateFromFile,
} from 'obsidian-daily-notes-interface';

export function gotoNextDailyNote(app: App, file: TFile) {
  const date = getDateFromFile(file, 'day');

  if (!date || !date.isValid()) {
    return;
  }

  const dailyNotePlugin = (app as any).internalPlugins.plugins['daily-notes']
    .instance;

  dailyNotePlugin.gotoNextExisting(date);
}

export function gotoPrevDailyNote(app: App, file: TFile) {
  const date = getDateFromFile(file, 'day');

  if (!date || !date.isValid()) {
    return;
  }

  const dailyNotePlugin = (app as any).internalPlugins.plugins['daily-notes']
    .instance;

  dailyNotePlugin.gotoPreviousExisting(date);
}

export function buildLinkToDailyNote(app: App, dateStr: string) {
  const dailyNoteSettings = getDailyNoteSettings();
  const shouldUseMarkdownLinks = !!(app.vault as any).getConfig(
    'useMarkdownLinks'
  );

  if (shouldUseMarkdownLinks) {
    return `[${dateStr}](${
      dailyNoteSettings.folder
        ? `${encodeURIComponent(dailyNoteSettings.folder)}/`
        : ''
    }${encodeURIComponent(dateStr)}.md)`;
  }

  return `[[${dateStr}]]`;
}

export function hasFrontmatterKeyRaw(data: string) {
  if (!data) return false;

  const match = data.match(/---\s+([\w\W]+?)\s+---/);

  if (!match) {
    return false;
  }

  if (!match[1].contains('kanban-plugin')) {
    return false;
  }

  return true;
}

export function hasFrontmatterKey(file: TFile) {
  if (!file) return false;

  const cache = app.metadataCache.getFileCache(file);

  return !!cache?.frontmatter && !!cache?.frontmatter['kanban-plugin'];
}

export function laneTitleWithMaxItems(title: string, maxItems?: number) {
  if (!maxItems) return title;
  return `${title} (${maxItems})`;
}

// @DONE incorporate period based parsing helper function
export function parsePeriod(periodStr: string) {
  // parse the time string by iso format
  let period : Record<'unit' | 'isoFormat', string> = null
  let periodMoment = null
  const periods = [
    { unit: 'day', isoFormat: 'YYYY-MM-DD'},
    { unit: 'week', isoFormat: 'gggg-[W]ww'},
    { unit: 'month', isoFormat: 'YYYY-MM'},
    { unit: 'quarter', isoFormat: 'YYYY-[Q]Q'},
    { unit: 'year', isoFormat: 'YYYY'}
  ]
  // iterate through period units and get due date from end of periods
  for (let p of periods) {
    periodMoment = moment(periodStr, p.isoFormat, true).endOf(p.unit)
    if (periodMoment.isValid()) {
        period = p
        break
    }
  }
  if (!period) {
      console.error(`invalid period format: ${periodStr}`)
  }
  return { period: periodMoment, unit: period.unit, format: period.isoFormat }
}
