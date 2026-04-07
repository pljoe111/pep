import React from 'react';
import { ReactionType, ReactionCountsDto } from 'api-client';
import { useAddReaction, useRemoveReaction } from '../../api/hooks/useCampaigns';

interface ReactionBarProps {
  campaignId: string;
  reactions: ReactionCountsDto;
  myReaction: ReactionType | null;
  isAuthenticated: boolean;
  isOwner: boolean;
}

const REACTION_ORDER: ReactionType[] = ['thumbs_up', 'rocket', 'praising_hands', 'mad', 'fire'];

const EMOJI: Record<ReactionType, string> = {
  thumbs_up: '👍',
  rocket: '🚀',
  praising_hands: '🙌',
  mad: '😤',
  fire: '🔥',
};

export function ReactionBar({
  campaignId,
  reactions,
  myReaction,
  isAuthenticated,
  isOwner,
}: ReactionBarProps): React.ReactElement {
  const addReaction = useAddReaction(campaignId);
  const removeReaction = useRemoveReaction(campaignId);

  const canInteract = isAuthenticated && !isOwner;

  const handleToggle = (type: ReactionType) => {
    if (!canInteract) return;
    if (myReaction === type) {
      removeReaction.mutate(type);
    } else {
      addReaction.mutate({ reaction_type: type });
    }
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
      {REACTION_ORDER.map((type) => {
        const isSelected = myReaction === type;
        const count = reactions[type] || 0;

        return (
          <button
            key={type}
            type="button"
            onClick={() => handleToggle(type)}
            disabled={addReaction.isPending || removeReaction.isPending}
            className={`
              flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm min-h-[36px] transition-colors
              ${
                isSelected
                  ? 'bg-primary-l border-primary text-primary'
                  : 'border-border bg-surface text-text hover:bg-surface-a'
              }
              ${!canInteract ? 'cursor-default hover:bg-surface' : 'cursor-pointer'}
              ${addReaction.isPending || removeReaction.isPending ? 'opacity-70' : ''}
            `}
          >
            <span>{EMOJI[type]}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
