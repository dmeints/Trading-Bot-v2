import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
// import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Search, Filter, Download, Brain, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  fee: string;
  pnl: string;
  orderType: string;
  aiRecommendation: boolean;
  confidence?: number;
  executedAt: Date;
  reasoning?: string;
  tags?: string[];
  notes?: string;
}

interface JournalEntry {
  id: string;
  tradeId: string;
  userId: string;
  reasoning: string;
  marketConditions: string;
  emotionalState: string;
  lessons: string;
  rating: number; // 1-5 stars
  tags: string[];
  createdAt: Date;
}

interface TradeAnalysis {
  winRate: number;
  avgReturn: number;
  bestStrategy: string;
  worstStrategy: string;
  emotionalBias: string[];
  improvementAreas: string[];
}

export default function TradeJournal() {
  const { isAuthenticated, isLoading } = useAuth();

  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [journalEntry, setJournalEntry] = useState({
    reasoning: '',
    marketConditions: '',
    emotionalState: '',
    lessons: '',
    rating: 3,
    tags: [] as string[]
  });

  // Query for trades with journal entries
  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trading/trades', { 
      from: dateRange.from.toISOString(), 
      to: dateRange.to.toISOString(),
      search: searchTerm,
      strategy: selectedStrategy
    }],
    enabled: isAuthenticated
  });

  // Query for journal analysis
  const { data: analysis } = useQuery<TradeAnalysis>({
    queryKey: ['/api/journal/analysis', {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString()
    }],
    enabled: isAuthenticated
  });

  // Query for performance data
  const { data: performanceData = [] } = useQuery({
    queryKey: ['/api/journal/performance', {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString()
    }],
    enabled: isAuthenticated
  });

  const filteredTrades = trades.filter(trade => {
    const matchesSearch = searchTerm === '' || 
      trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trade.reasoning?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStrategy = selectedStrategy === 'all' || 
      trade.tags?.includes(selectedStrategy);

    return matchesSearch && matchesStrategy;
  });

  const handleTradeSelect = (trade: Trade) => {
    setSelectedTrade(trade);
    // Load existing journal entry if available
    // For now, using placeholder data
    setJournalEntry({
      reasoning: trade.reasoning || '',
      marketConditions: '',
      emotionalState: '',
      lessons: '',
      rating: 3,
      tags: trade.tags || []
    });
  };

  const getTradeStatusColor = (pnl: string) => {
    const pnlValue = parseFloat(pnl);
    if (pnlValue > 0) return 'text-green-400';
    if (pnlValue < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-400';
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TopNavigation />

      <div className="flex pt-16">
        <SidebarNavigation />

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-blue-400" />
                <h1 className="text-2xl font-bold">Trade Journal</h1>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" data-testid="button-export-journal">
                  <Download className="w-4 h-4 mr-2" />
                  Export Journal
                </Button>
              </div>
            </div>

            {/* Analysis Overview */}
            {analysis && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <div>
                        <div className="text-2xl font-bold text-green-400" data-testid="metric-win-rate">
                          {analysis.winRate.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-400">Win Rate</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="text-2xl font-bold text-blue-400" data-testid="metric-avg-return">
                          {analysis.avgReturn.toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-400">Avg Return</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div>
                      <div className="text-lg font-bold text-purple-400" data-testid="metric-best-strategy">
                        {analysis.bestStrategy}
                      </div>
                      <div className="text-sm text-gray-400">Best Strategy</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div>
                      <div className="text-lg font-bold text-orange-400" data-testid="metric-total-entries">
                        {filteredTrades.length}
                      </div>
                      <div className="text-sm text-gray-400">Journal Entries</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trade List & Filters */}
              <div className="lg:col-span-2 space-y-6">
                {/* Filters */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-48">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="Search trades, symbols, or reasoning..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                            data-testid="input-search-trades"
                          />
                        </div>
                      </div>

                      <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                        <SelectTrigger className="w-48" data-testid="select-strategy-filter">
                          <SelectValue placeholder="All Strategies" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Strategies</SelectItem>
                          <SelectItem value="momentum">Momentum</SelectItem>
                          <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                          <SelectItem value="breakout">Breakout</SelectItem>
                          <SelectItem value="ai_hybrid">AI Hybrid</SelectItem>
                        </SelectContent>
                      </Select>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-48">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={(range) => range && setDateRange(range)}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardContent>
                </Card>

                {/* Trade List */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Trade History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tradesLoading ? (
                      <div className="text-center py-8 text-gray-400">Loading trades...</div>
                    ) : filteredTrades.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">No trades found matching your filters</div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTrades.map((trade) => (
                          <div
                            key={trade.id}
                            className={`p-4 rounded border cursor-pointer transition-colors ${
                              selectedTrade?.id === trade.id
                                ? 'border-blue-500 bg-blue-900/20'
                                : 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/50'
                            }`}
                            onClick={() => handleTradeSelect(trade)}
                            data-testid={`trade-item-${trade.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="font-medium">{trade.symbol}</div>
                                  <div className="text-sm text-gray-400">
                                    {format(new Date(trade.executedAt), "MMM dd, HH:mm")}
                                  </div>
                                </div>
                                <Badge 
                                  variant={trade.side === 'buy' ? 'default' : 'secondary'}
                                  data-testid={`trade-side-badge-${trade.id}`}
                                  aria-label={`Trade side: ${trade.side}`}
                                >
                                  {trade.side.toUpperCase()}
                                </Badge>
                                {trade.aiRecommendation && (
                                  <Badge variant="outline" className="border-purple-500 text-purple-400"
                                    data-testid={`trade-ai-badge-${trade.id}`}
                                    aria-label="AI Recommended Trade"
                                  >
                                    <Brain className="w-3 h-3 mr-1" />
                                    AI
                                  </Badge>
                                )}
                              </div>

                              <div className="text-right">
                                <div className={`font-mono font-semibold ${getTradeStatusColor(trade.pnl)}`}>
                                  ${parseFloat(trade.pnl).toFixed(2)}
                                </div>
                                {trade.confidence && (
                                  <div className={`text-sm ${getConfidenceColor(trade.confidence)}`}>
                                    {(trade.confidence * 100).toFixed(0)}% conf
                                  </div>
                                )}
                              </div>
                            </div>

                            {trade.reasoning && (
                              <div className="mt-2 text-sm text-gray-300 line-clamp-2">
                                {trade.reasoning}
                              </div>
                            )}

                            {trade.tags && trade.tags.length > 0 && (
                              <div className="mt-2 flex gap-1">
                                {trade.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs"
                                    data-testid={`trade-tag-badge-${tag}-${trade.id}`}
                                    aria-label={`Tag: ${tag}`}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Journal Entry Form */}
              <div className="space-y-6">
                {selectedTrade ? (
                  <>
                    {/* Trade Details */}
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="w-5 h-5" />
                          Trade Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Symbol:</span>
                            <div className="font-medium">{selectedTrade.symbol}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Side:</span>
                            <div className="font-medium">{selectedTrade.side.toUpperCase()}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Quantity:</span>
                            <div className="font-mono">{parseFloat(selectedTrade.quantity).toFixed(6)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Price:</span>
                            <div className="font-mono">${parseFloat(selectedTrade.price).toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">P&L:</span>
                            <div className={`font-mono ${getTradeStatusColor(selectedTrade.pnl)}`}>
                              ${parseFloat(selectedTrade.pnl).toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">Fee:</span>
                            <div className="font-mono">${parseFloat(selectedTrade.fee).toFixed(2)}</div>
                          </div>
                        </div>

                        {selectedTrade.confidence && (
                          <div className="pt-2 border-t border-gray-700">
                            <span className="text-gray-400 text-sm">AI Confidence:</span>
                            <div className={`text-lg font-semibold ${getConfidenceColor(selectedTrade.confidence)}`}>
                              {(selectedTrade.confidence * 100).toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Journal Entry Form */}
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle>Journal Entry</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="reasoning">AI Reasoning</Label>
                          <textarea
                            id="reasoning"
                            value={journalEntry.reasoning}
                            onChange={(e) => setJournalEntry({...journalEntry, reasoning: e.target.value})}
                            placeholder="What was the AI's reasoning for this trade?"
                            className="min-h-20 w-full p-2 rounded border border-gray-600 bg-gray-700 text-white"
                            data-testid="textarea-reasoning"
                          />
                        </div>

                        <div>
                          <Label htmlFor="marketConditions">Market Conditions</Label>
                          <textarea
                            id="marketConditions"
                            value={journalEntry.marketConditions}
                            onChange={(e) => setJournalEntry({...journalEntry, marketConditions: e.target.value})}
                            placeholder="Describe the market conditions when this trade was made..."
                            className="min-h-16 w-full p-2 rounded border border-gray-600 bg-gray-700 text-white"
                            data-testid="textarea-market-conditions"
                          />
                        </div>

                        <div>
                          <Label htmlFor="emotionalState">Emotional State</Label>
                          <textarea
                            id="emotionalState"
                            value={journalEntry.emotionalState}
                            onChange={(e) => setJournalEntry({...journalEntry, emotionalState: e.target.value})}
                            placeholder="How did you feel about this trade? Any emotional biases?"
                            className="min-h-16 w-full p-2 rounded border border-gray-600 bg-gray-700 text-white"
                            data-testid="textarea-emotional-state"
                          />
                        </div>

                        <div>
                          <Label htmlFor="lessons">Lessons Learned</Label>
                          <textarea
                            id="lessons"
                            value={journalEntry.lessons}
                            onChange={(e) => setJournalEntry({...journalEntry, lessons: e.target.value})}
                            placeholder="What did you learn from this trade? What would you do differently?"
                            className="min-h-16 w-full p-2 rounded border border-gray-600 bg-gray-700 text-white"
                            data-testid="textarea-lessons"
                          />
                        </div>

                        <div>
                          <Label>Trade Rating</Label>
                          <div className="flex gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setJournalEntry({...journalEntry, rating: star})}
                                className={`text-2xl ${star <= journalEntry.rating ? 'text-yellow-400' : 'text-gray-600'}`}
                                data-testid={`rating-star-${star}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>

                        <Button className="w-full" data-testid="button-save-entry button-execute">
                          Save Journal Entry
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="bg-gray-800 border-gray-700 h-96 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">Select a Trade</h3>
                      <p>Choose a trade from the list to view details and add journal entries.</p>
                    </div>
                  </Card>
                )}

                {/* Performance Chart */}
                {performanceData.length > 0 && (
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle>Performance Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={performanceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="date" stroke="#9CA3AF" />
                          <YAxis stroke="#9CA3AF" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="cumulative_pnl"
                            stroke="#10B981"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}