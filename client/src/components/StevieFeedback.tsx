/**
 * Stevie Feedback Component
 * 
 * Thumbs-up/down feedback interface for continuous improvement
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface StevieFeedbackProps {
  interactionType: 'chat' | 'trade_suggestion' | 'risk_alert' | 'market_analysis';
  className?: string;
}

export function StevieFeedback({ interactionType, className = '' }: StevieFeedbackProps) {
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedRating, setSelectedRating] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const feedbackMutation = useMutation({
    mutationFn: async (feedback: any) => {
      return await apiRequest('/api/stevie/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback)
      });
    },
    onSuccess: () => {
      toast({
        title: "Thanks for the feedback!",
        description: "Stevie is always learning and improving. Your input helps!",
        duration: 3000,
      });
      setFeedbackGiven(true);
      setShowCommentDialog(false);
      setComment('');
    },
    onError: () => {
      toast({
        title: "Feedback Error",
        description: "Couldn't record your feedback right now. Try again later.",
        variant: "destructive",
      });
    }
  });

  const handleQuickFeedback = (type: 'positive' | 'negative') => {
    const rating = type === 'positive' ? 5 : 2;
    
    feedbackMutation.mutate({
      interactionType,
      feedback: type,
      rating
    });
  };

  const handleDetailedFeedback = () => {
    if (!comment.trim() || selectedRating === 0) {
      toast({
        title: "More Details Needed",
        description: "Please provide a rating and comment.",
        variant: "destructive",
      });
      return;
    }

    feedbackMutation.mutate({
      interactionType,
      feedback: selectedRating >= 4 ? 'positive' : selectedRating <= 2 ? 'negative' : 'neutral',
      rating: selectedRating,
      comment: comment.trim()
    });
  };

  if (feedbackGiven) {
    return (
      <div className={`flex items-center gap-2 text-green-600 text-sm ${className}`}>
        <ThumbsUp className="h-4 w-4" />
        <span>Thanks for the feedback!</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="stevie-feedback">
      {/* Quick thumbs up/down */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleQuickFeedback('positive')}
        disabled={feedbackMutation.isPending}
        data-testid="feedback-thumbs-up"
        className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleQuickFeedback('negative')}
        disabled={feedbackMutation.isPending}
        data-testid="feedback-thumbs-down"
        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>

      {/* Detailed feedback dialog */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            data-testid="feedback-detailed"
            className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Help Stevie Improve</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Star rating */}
            <div className="space-y-2">
              <label className="text-sm font-medium">How helpful was Stevie?</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setSelectedRating(star)}
                    data-testid={`rating-star-${star}`}
                  >
                    <span className={`text-lg ${star <= selectedRating ? 'text-yellow-400' : 'text-gray-300'}`}>
                      ⭐
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Comments</label>
              <Textarea
                placeholder="What went well? What could be better? Any specific suggestions?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                data-testid="feedback-comment"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCommentDialog(false)}
                data-testid="feedback-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDetailedFeedback}
                disabled={feedbackMutation.isPending || !comment.trim() || selectedRating === 0}
                data-testid="feedback-submit"
              >
                {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StevieFeedback;