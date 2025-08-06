import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Star, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface FeedbackFormData {
  rating: number;
  category: string;
  message: string;
  page: string;
}

const feedbackCategories = [
  'UI/UX',
  'Performance',
  'Bug Report',
  'Feature Request',
  'Trading Experience',
  'Data Accuracy',
  'Other'
];

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: FeedbackFormData) => {
      return apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(feedbackData),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! It helps us improve Skippy.",
      });
      setIsOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feedback'] });
    },
    onError: (error) => {
      console.error('Feedback submission error:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRating(0);
    setCategory('');
    setMessage('');
    setHoveredStar(0);
  };

  const handleSubmit = () => {
    if (!rating || !category || !message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a rating, category, and message.",
        variant: "destructive",
      });
      return;
    }

    const feedbackData: FeedbackFormData = {
      rating,
      category,
      message: message.trim(),
      page: window.location.pathname,
    };

    submitFeedbackMutation.mutate(feedbackData);
  };

  const renderStars = () => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`w-8 h-8 rounded transition-colors ${
              (hoveredStar >= star || rating >= star)
                ? 'text-yellow-400'
                : 'text-gray-400 hover:text-yellow-200'
            }`}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
            data-testid={`star-rating-${star}`}
          >
            <Star className="w-full h-full fill-current" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 left-4 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 z-50 shadow-lg"
          data-testid="button-feedback-open"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Feedback
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-gray-800 border-gray-700 text-gray-200">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Send Feedback</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Rating */}
          <div>
            <label className="text-sm font-medium text-gray-200 mb-2 block">
              Overall Rating
            </label>
            {renderStars()}
            {rating > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {rating === 1 && "Needs improvement"}
                {rating === 2 && "Below expectations"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very good"}
                {rating === 5 && "Excellent!"}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-gray-200 mb-2 block">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {feedbackCategories.map((cat) => (
                <Badge
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    category === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                  onClick={() => setCategory(cat)}
                  data-testid={`category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium text-gray-200 mb-2 block">
              Message
            </label>
            <Textarea
              placeholder="Tell us about your experience with Skippy..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400 resize-none"
              rows={4}
              maxLength={1000}
              data-testid="textarea-feedback-message"
            />
            <p className="text-xs text-gray-400 mt-1">
              {message.length}/1000 characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitFeedbackMutation.isPending || !rating || !category || !message.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              data-testid="button-submit-feedback"
            >
              {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}