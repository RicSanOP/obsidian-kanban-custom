import update from 'immutability-helper';
import Preact from 'preact/compat';

import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { Lane } from '../types';

export interface LaneSettingsProps {
  lane: Lane;
  lanePath: Path;
}

// @DONE added the ability for lanes to check off items when complete setting is toggled
export function LaneSettings({ lane, lanePath }: LaneSettingsProps) {
  const { boardModifiers } = Preact.useContext(KanbanContext);

  return (
    <div className={c('lane-setting-wrapper')}>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>
          {t('Mark cards in this list as complete')}
        </div>
        <div
          onClick={() => {
            const newLane = update(lane, {
              children: {
                $set: lane.children.map((item, i) => {
                  const itemPath = lanePath.concat([i])
                  const newItem = update(item, {
                    data: { 
                      completeMarker: { $set: lane.data.itemsCompleteMarker },
                      isComplete: { $set: !lane.data.shouldMarkItemsComplete },
                    },
                  })
                  boardModifiers.updateItem(
                    itemPath,
                    newItem
                  )
                  return newItem
                })
              }
            })
            boardModifiers.updateLane(
              lanePath,
              update(newLane, {
                data: { $toggle: ['shouldMarkItemsComplete'] },
              })
            )
          }}
          className={`checkbox-container ${
            lane.data.shouldMarkItemsComplete ? 'is-enabled' : ''
          }`}
        />
      </div>
    </div>
  );
}
