import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageCircle, 
  Share2, 
  TrendingUp, 
  TrendingDown,
  Copy,
  Eye,
  Users,
  Star,
  BarChart3
} from 'lucide-react';

interface TradePost {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  isVerified: boolean;
  rank: string;
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: string;
  caption: string;
  pnl: number;
  pnlPercentage: number;
  likes: number;
  dislikes: number;
  comments: number;
  isLiked: boolean;
  isDisliked: boolean;
  isFollowing: boolean;
  followers: number;
  winRate: number;
}

export default function SocialTradingFeed() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState('');

  const { data: posts = [], isLoading } = useQuery<TradePost[]>({
    queryKey: ['/api/social/feed'],
    refetchInterval: 30000,
  });

  const likeMutation = useMutation({
    mutationFn: async ({ postId, action }: { postId: string; action: 'like' | 'dislike' }) => {
      const response = await fetch(`/api/social/posts/${postId}/${action}`, { method: 'POST' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/feed'] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/social/follow/${userId}`, { method: 'POST' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/feed'] });
      toast({
        title: "Following Updated",
        description: "Your following list has been updated",
      });
    },
  });

  const copyTradeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/social/copy-trade/${postId}`, { method: 'POST' });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Trade Copied",
        description: "The trade has been copied to your portfolio",
      });
    },
  });

  const handleLike = (postId: string, currentlyLiked: boolean) => {
    likeMutation.mutate({ 
      postId, 
      action: currentlyLiked ? 'dislike' : 'like' 
    });
  };

  const handleFollow = (userId: string) => {
    followMutation.mutate(userId);
  };

  const handleCopyTrade = (postId: string) => {
    copyTradeMutation.mutate(postId);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getRankColor = (rank: string) => {
    const rankLower = rank.toLowerCase();
    if (rankLower.includes('master') || rankLower.includes('pro')) return 'text-purple-400';
    if (rankLower.includes('expert') || rankLower.includes('advanced')) return 'text-blue-400';
    if (rankLower.includes('intermediate')) return 'text-green-400';
    return 'text-gray-400';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/4 mt-1"></div>
                  </div>
                </div>
                <div className="h-16 bg-gray-700 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Share Your Trade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Share your latest trade, analysis, or market insight..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white min-h-[100px]"
          />
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Share your trades to build your reputation and connect with other traders
            </div>
            <Button
              onClick={() => {
                toast({
                  title: "Feature Coming Soon",
                  description: "Social posting will be available in the next update",
                });
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Share Trade
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trading Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="bg-gray-800 border-gray-700 hover:bg-gray-700/50 transition-colors">
            <CardContent className="p-0">
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={post.avatar} />
                      <AvatarFallback className="bg-blue-600 text-white">
                        {post.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-white">{post.username}</span>
                        {post.isVerified && (
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        )}
                        <Badge variant="outline" className={`text-xs ${getRankColor(post.rank)}`}>
                          {post.rank}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>{formatTimeAgo(post.timestamp)}</span>
                        <span className="flex items-center space-x-1">
                          <Users className="w-3 h-3" />
                          <span>{post.followers}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <BarChart3 className="w-3 h-3" />
                          <span>{post.winRate}% win rate</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={post.isFollowing ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleFollow(post.userId)}
                    className={post.isFollowing ? "" : "bg-blue-600 hover:bg-blue-700"}
                  >
                    {post.isFollowing ? 'Following' : 'Follow'}
                  </Button>
                </div>
              </div>

              {/* Trade Details */}
              <div className="p-4 bg-gray-750">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Symbol</div>
                    <div className="font-mono text-white font-medium">{post.symbol}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Action</div>
                    <div className={`flex items-center space-x-1 ${
                      post.action === 'buy' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {post.action === 'buy' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="font-medium uppercase">{post.action}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">P&L</div>
                    <div className={`font-medium ${post.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {post.pnl >= 0 ? '+' : ''}${(post.pnl || 0).toFixed(2)}
                      <span className="text-xs ml-1">
                        ({post.pnl >= 0 ? '+' : ''}{(post.pnlPercentage || 0).toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Price: </span>
                    <span className="text-white font-mono">${(post.price || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Quantity: </span>
                    <span className="text-white font-mono">{(post.quantity || 0).toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* Caption */}
              {post.caption && (
                <div className="p-4">
                  <p className="text-gray-300 text-sm leading-relaxed">{post.caption}</p>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id, post.isLiked)}
                      className={`flex items-center space-x-2 ${
                        post.isLiked ? 'text-green-400' : 'text-gray-400'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{post.likes}</span>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center space-x-2 text-gray-400"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments}</span>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center space-x-2 text-gray-400"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={() => handleCopyTrade(post.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
                    data-testid={`button-${post.action} button-copy-trade`}
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Trade</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}