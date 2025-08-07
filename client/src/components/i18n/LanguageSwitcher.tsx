import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_LOCALES } from '@/lib/i18n';

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Español',
};

export function LanguageSwitcher() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get current user preferences
  const { data: preferences } = useQuery({
    queryKey: ['/api/preferences'],
  });

  // Update language preference
  const updateLanguageMutation = useMutation({
    mutationFn: async (language: string) => {
      return await apiRequest('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
    },
    onSuccess: (_, language) => {
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
      toast({
        title: 'Language Updated',
        description: `Language changed to ${LANGUAGE_NAMES[language as keyof typeof LANGUAGE_NAMES]}`,
      });
      // Reload page to apply language changes
      window.location.reload();
    },
  });

  const handleLanguageChange = (language: string) => {
    updateLanguageMutation.mutate(language);
  };

  const currentLanguage = (preferences as any)?.language || 'en';

  return (
    <div className="flex items-center space-x-2">
      <Globe className="w-4 h-4 text-gray-400" />
      <Select
        value={currentLanguage}
        onValueChange={handleLanguageChange}
        disabled={updateLanguageMutation.isPending}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {LANGUAGE_NAMES[locale as keyof typeof LANGUAGE_NAMES]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}