import classcat from 'classcat';
import { getLinkpath } from 'obsidian';
import Preact from 'preact/compat';

import { KanbanContext } from '../context';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c } from '../helpers';
import { t } from 'src/lang/helpers';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface LaneCompleteMarkerProps {
  marker: string;
  isEditing: boolean;
  setIsEditing: Preact.StateUpdater<boolean>;
  onChange: Preact.ChangeEventHandler<HTMLTextAreaElement>;
}

// @DONE add complete marker modifier to the lane settings (note the incorrect style class name using checkbox styling and lack of locale t)
export function LaneCompleteMarker({
  isEditing,
  setIsEditing,
  marker,
  onChange,
}: LaneCompleteMarkerProps) {
  const { stateManager } = Preact.useContext(KanbanContext);
  const inputRef = Preact.useRef<HTMLTextAreaElement>();

  const onEnter = (e: KeyboardEvent) => {
    if (!allowNewLine(e, stateManager)) {
      e.preventDefault();
      isEditing && setIsEditing(false);
    }
  };

  const onSubmit = () => {
    isEditing && setIsEditing(false);
  };

  const onEscape = () => {
    isEditing && setIsEditing(false);
  };

  Preact.useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;

      inputRef.current.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }, [isEditing]);

  return (
    <>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>
          {'Mark complete cards in this list with this character'}
        </div>
        <MarkdownEditor
            ref={inputRef}
            className={c('lane-input')}
            onChange={onChange}
            onEnter={onEnter}
            onEscape={onEscape}
            onSubmit={onSubmit}
            value={marker}
        />
      </div>
    </>
  );
}
