import update from 'immutability-helper';
import { Content, List, Parent, Root } from 'mdast';
import { ListItem, Paragraph } from 'mdast-util-from-markdown/lib';
import { toString } from 'mdast-util-to-string';
import { stringifyYaml } from 'obsidian';
import { visit } from 'unist-util-visit';

import { generateInstanceId } from 'src/components/helpers';
import {
  Board,
  BoardTemplate,
  Item,
  ItemData,
  ItemTemplate,
  Lane,
  LaneTemplate,
} from 'src/components/types';
import { laneTitleWithMaxItems } from 'src/helpers';
import { t } from 'src/lang/helpers';
import { KanbanSettings } from 'src/Settings';
import { StateManager } from 'src/StateManager';

import { archiveString, completeString, settingsToCodeblock } from '../common';
import { DateNode, FileNode, TimeNode, ValueNode } from '../extensions/types';
import {
  getNextOfType,
  getNodeContentBoundary,
  getPrevSibling,
  getStringFromBoundary,
} from '../helpers/ast';
import { hydrateItem } from '../helpers/hydrateBoard';
import {
  executeDeletion,
  markRangeForDeletion,
  parseLaneTitle,
  replaceBrs,
  replaceNewLines,
} from '../helpers/parser';
import { parseFragment } from '../parseMarkdown';

export function listItemToItemData(
  stateManager: StateManager,
  md: string,
  item: ListItem
) {
  const hideTagsInTitle = stateManager.getSetting('hide-tags-in-title');
  const hideDateInTitle = stateManager.getSetting('hide-date-in-title');

  const itemBoundary = getNodeContentBoundary(item.children[0] as Paragraph);
  let itemContent = getStringFromBoundary(md, itemBoundary);

  // Handle empty task
  if (itemContent === '[ ]' || itemContent === '[x]') {
    itemContent = '';
  }

  let title = itemContent;

  // @DONE add assignment for complete marker if the mdast plugin ListItem does
  const itemData: ItemData = {
    titleRaw: replaceBrs(itemContent),
    blockId: undefined,
    title: '',
    titleSearch: '',
    metadata: {
      dateStr: undefined,
      date: undefined,
      time: undefined,
      timeStr: undefined,
      tags: [],
      fileAccessor: undefined,
      file: undefined,
      fileMetadata: undefined,
      fileMetadataOrder: undefined,
    },
    dom: undefined,
    isComplete: !!item.checked,
    completeMarker: item.checkChar,
  };

  visit(
    item,
    (node) => {
      return node.type !== 'paragraph';
    },
    (node) => {
      const genericNode = node as ValueNode;

      if (genericNode.type === 'blockid') {
        itemData.blockId = genericNode.value;
        return true;
      }

      if (genericNode.type === 'hashtag') {
        if (!itemData.metadata.tags) {
          itemData.metadata.tags = [];
        }

        itemData.metadata.tags.push('#' + genericNode.value);

        if (hideTagsInTitle) {
          title = markRangeForDeletion(title, {
            start: node.position.start.offset - itemBoundary.start,
            end: node.position.end.offset - itemBoundary.start,
          });
        }
        return true;
      }

      if (genericNode.type === 'date' || genericNode.type === 'dateLink') {
        itemData.metadata.dateStr = (genericNode as DateNode).date;

        if (hideDateInTitle) {
          title = markRangeForDeletion(title, {
            start: node.position.start.offset - itemBoundary.start,
            end: node.position.end.offset - itemBoundary.start,
          });
        }
        return true;
      }

      if (genericNode.type === 'time') {
        itemData.metadata.timeStr = (genericNode as TimeNode).time;
        title = markRangeForDeletion(title, {
          start: node.position.start.offset - itemBoundary.start,
          end: node.position.end.offset - itemBoundary.start,
        });
        return true;
      }

      if (genericNode.type === 'embedWikilink') {
        itemData.metadata.fileAccessor = (genericNode as FileNode).fileAccessor;
        return true;
      }

      if (genericNode.type === 'wikilink') {
        itemData.metadata.fileAccessor = (genericNode as FileNode).fileAccessor;
        itemData.metadata.fileMetadata = (genericNode as FileNode).fileMetadata;
        itemData.metadata.fileMetadataOrder = (
          genericNode as FileNode
        ).fileMetadataOrder;
        return true;
      }

      if (
        genericNode.type === 'link' &&
        (genericNode as FileNode).fileAccessor
      ) {
        itemData.metadata.fileAccessor = (genericNode as FileNode).fileAccessor;
        itemData.metadata.fileMetadata = (genericNode as FileNode).fileMetadata;
        itemData.metadata.fileMetadataOrder = (
          genericNode as FileNode
        ).fileMetadataOrder;
        return true;
      }

      if (genericNode.type === 'embedLink') {
        itemData.metadata.fileAccessor = (genericNode as FileNode).fileAccessor;
        return true;
      }
    }
  );

  itemData.title = replaceBrs(executeDeletion(title));

  return itemData;
}

function isArchiveLane(
  child: Content,
  children: Content[],
  currentIndex: number
) {
  if (
    child.type !== 'heading' ||
    toString(child, { includeImageAlt: false }) !== t('Archive')
  ) {
    return false;
  }

  const prev = getPrevSibling(children, currentIndex);

  return prev && prev.type === 'thematicBreak';
}

// @DONE read complete marker setting from lane complete line (comes in between curly braces)
export function astToUnhydratedBoard(
  stateManager: StateManager,
  settings: KanbanSettings,
  frontmatter: Record<string, any>,
  root: Root,
  md: string
): Board {
  const lanes: Lane[] = [];
  const archive: Item[] = [];

  root.children.forEach((child, index) => {
    if (child.type === 'heading') {
      const isArchive = isArchiveLane(child, root.children, index);
      const headingBoundary = getNodeContentBoundary(child as Parent);
      const title = getStringFromBoundary(md, headingBoundary);

      let shouldMarkItemsComplete = false;
      let itemsCompleteMarker = 'x';

      const list = getNextOfType(root.children, index, 'list', (child) => {
        if (child.type === 'heading') return false;

        if (child.type === 'paragraph') {
          const childStr = toString(child);

          if (childStr.startsWith('%% kanban:settings')) {
            return false;
          }

          let childRegex = childStr.match(`${t('Complete')} \{(.)\}`)
          if (childRegex[1]) {
            shouldMarkItemsComplete = true;
            itemsCompleteMarker = childRegex[1]
            return true;
          }
        }

        return true;
      });

      if (isArchive && list) {
        archive.push(
          ...(list as List).children.map((listItem) => {
            return {
              ...ItemTemplate,
              id: generateInstanceId(),
              data: listItemToItemData(stateManager, md, listItem),
            };
          })
        );

        return;
      }

      if (!list) {
        lanes.push({
          ...LaneTemplate,
          children: [],
          id: generateInstanceId(),
          data: {
            ...parseLaneTitle(title),
            shouldMarkItemsComplete,
            itemsCompleteMarker,
          },
        });
      } else {
        lanes.push({
          ...LaneTemplate,
          children: (list as List).children.map((listItem) => {
            return {
              ...ItemTemplate,
              id: generateInstanceId(),
              data: listItemToItemData(stateManager, md, listItem),
            };
          }),
          id: generateInstanceId(),
          data: {
            ...parseLaneTitle(title),
            shouldMarkItemsComplete,
            itemsCompleteMarker,
          },
        });
      }
    }
  });

  return {
    ...BoardTemplate,
    id: stateManager.file.path,
    children: lanes,
    data: {
      settings,
      frontmatter,
      archive,
      isSearching: false,
      errors: [],
    },
  };
}

// @DONE use complete marker text here
export async function updateItemContent(
  stateManager: StateManager,
  oldItem: Item,
  newContent: string
) {
  const md = `- [${oldItem.data.isComplete ? oldItem.data.completeMarker : ' '}] ${replaceNewLines(
    newContent
  )}${oldItem.data.blockId ? ` ^${oldItem.data.blockId}` : ''}`;

  const ast = parseFragment(stateManager, md);

  const itemData = listItemToItemData(
    stateManager,
    md,
    (ast.children[0] as List).children[0]
  );

  const newItem = update(oldItem, {
    data: {
      $set: itemData,
    },
  });

  try {
    await hydrateItem(stateManager, newItem);
  } catch (e) {
    console.error(e);
  }

  return newItem;
}

// @DONE use complete marker text here
export async function newItem(
  stateManager: StateManager,
  newContent: string,
  isComplete?: boolean,
  forceEdit?: boolean,
  completeMarker?: string
) {
  const md = `- [${isComplete ? completeMarker : ' '}] ${replaceNewLines(newContent)}`;

  const ast = parseFragment(stateManager, md);

  const itemData = listItemToItemData(
    stateManager,
    md,
    (ast.children[0] as List).children[0]
  );

  itemData.forceEditMode = !!forceEdit;

  const newItem: Item = {
    ...ItemTemplate,
    id: generateInstanceId(),
    data: itemData,
  };

  try {
    await hydrateItem(stateManager, newItem);
  } catch (e) {
    console.error(e);
  }

  return newItem;
}

export async function reparseBoard(stateManager: StateManager, board: Board) {
  try {
    return update(board, {
      children: {
        $set: await Promise.all(
          board.children.map(async (lane) => {
            try {
              return update(lane, {
                children: {
                  $set: await Promise.all(
                    lane.children.map((item) => {
                      return updateItemContent(
                        stateManager,
                        item,
                        item.data.titleRaw
                      );
                    })
                  ),
                },
              });
            } catch (e) {
              stateManager.setError(e);
              throw e;
            }
          })
        ),
      },
    });
  } catch (e) {
    stateManager.setError(e);
    throw e;
  }
}

// @DONE use complete marker text here
function itemToMd(item: Item) {
  return `- [${item.data.isComplete ? `${item.data.completeMarker}` : ' '}] ${replaceNewLines(
    item.data.titleRaw
  )}${item.data.blockId ? ` ^${item.data.blockId}` : ''}`;
}

function laneToMd(lane: Lane) {
  const lines: string[] = [];

  lines.push(
    `## ${replaceNewLines(
      laneTitleWithMaxItems(lane.data.title, lane.data.maxItems)
    )}`
  );

  lines.push('');

  // @DONE add complete marker to complete string serialization
  if (lane.data.shouldMarkItemsComplete) {
    lines.push(`${completeString} {${lane.data.itemsCompleteMarker}}`);
  }

  lane.children.forEach((item) => {
    lines.push(itemToMd(item));
  });

  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

function archiveToMd(archive: Item[]) {
  if (archive.length) {
    const lines: string[] = [archiveString, '', `## ${t('Archive')}`, ''];

    archive.forEach((item) => {
      lines.push(itemToMd(item));
    });

    return lines.join('\n');
  }

  return '';
}

export function boardToMd(board: Board) {
  const lanes = board.children.reduce((md, lane) => {
    return md + laneToMd(lane);
  }, '');

  const frontmatter = [
    '---',
    '',
    stringifyYaml(board.data.frontmatter),
    '---',
    '',
    '',
  ].join('\n');

  return (
    frontmatter +
    lanes +
    archiveToMd(board.data.archive) +
    settingsToCodeblock(board.data.settings)
  );
}
