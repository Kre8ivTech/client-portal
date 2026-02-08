"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, Check, AlertCircle, Bot, Sparkles } from "lucide-react";
import { updateAppSettings, type AppSettings } from "@/lib/actions/app-settings";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AIProvider = "openrouter" | "anthropic" | "openai" | "gemini";

interface AIProvidersFormProps {
  initialSettings: Pick<
    AppSettings,
    | "ai_provider_primary"
    | "openrouter_api_key"
    | "anthropic_api_key"
    | "openai_api_key"
    | "gemini_api_key"
  >;
}

const providerInfo: Record<AIProvider, { name: string; description: string; models: string }> = {
  openrouter: {
    name: "OpenRouter",
    description: "Access multiple AI models through a single API",
    models: "Claude, GPT-4, Llama, Mistral, and more",
  },
  anthropic: {
    name: "Anthropic",
    description: "Direct access to Claude models",
    models: "Claude 3.5, Claude 3 Opus, Sonnet, Haiku",
  },
  openai: {
    name: "OpenAI",
    description: "Direct access to GPT models",
    models: "GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo",
  },
  gemini: {
    name: "Google Gemini",
    description: "Google's most capable AI models",
    models: "Gemini Pro, Gemini Ultra, Gemini Flash",
  },
};

export function AIProvidersForm({ initialSettings }: AIProvidersFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [primaryProvider, setPrimaryProvider] = useState<AIProvider>(
    (initialSettings.ai_provider_primary as AIProvider) || "openrouter"
  );
  const [openrouterKey, setOpenrouterKey] = useState(initialSettings.openrouter_api_key || "");
  const [anthropicKey, setAnthropicKey] = useState(initialSettings.anthropic_api_key || "");
  const [openaiKey, setOpenaiKey] = useState(initialSettings.openai_api_key || "");
  const [geminiKey, setGeminiKey] = useState(initialSettings.gemini_api_key || "");

  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateAppSettings({
        ai_provider_primary: primaryProvider,
        openrouter_api_key: openrouterKey || null,
        anthropic_api_key: anthropicKey || null,
        openai_api_key: openaiKey || null,
        gemini_api_key: geminiKey || null,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to save settings");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getKeyForProvider = (provider: AIProvider) => {
    switch (provider) {
      case "openrouter":
        return openrouterKey;
      case "anthropic":
        return anthropicKey;
      case "openai":
        return openaiKey;
      case "gemini":
        return geminiKey;
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">AI Providers</CardTitle>
            <CardDescription>Configure AI providers for intelligent features</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <Check className="h-4 w-4" />
            <AlertDescription>Settings saved successfully!</AlertDescription>
          </Alert>
        )}

        {/* Primary Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="primary-provider">Primary AI Provider</Label>
          <Select value={primaryProvider} onValueChange={(v) => setPrimaryProvider(v as AIProvider)}>
            <SelectTrigger id="primary-provider" className="w-full">
              <SelectValue placeholder="Select primary provider" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(providerInfo) as AIProvider[]).map((provider) => (
                <SelectItem key={provider} value={provider}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {providerInfo[provider].name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This provider will be used as the default for AI features
          </p>
        </div>

        {/* Provider Cards */}
        <div className="grid gap-4">
          {/* OpenRouter */}
          <div className={`p-4 rounded-lg border ${primaryProvider === "openrouter" ? "border-primary bg-primary/5" : "border-slate-200"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{providerInfo.openrouter.name}</h4>
                  {primaryProvider === "openrouter" && (
                    <Badge variant="default" className="text-xs">Primary</Badge>
                  )}
                  {openrouterKey && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Configured</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{providerInfo.openrouter.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openrouter-key" className="text-sm">API Key</Label>
              <div className="relative">
                <Input
                  id="openrouter-key"
                  type={showOpenrouterKey ? "text" : "password"}
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                >
                  {showOpenrouterKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Anthropic */}
          <div className={`p-4 rounded-lg border ${primaryProvider === "anthropic" ? "border-primary bg-primary/5" : "border-slate-200"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{providerInfo.anthropic.name}</h4>
                  {primaryProvider === "anthropic" && (
                    <Badge variant="default" className="text-xs">Primary</Badge>
                  )}
                  {anthropicKey && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Configured</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{providerInfo.anthropic.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anthropic-key" className="text-sm">API Key</Label>
              <div className="relative">
                <Input
                  id="anthropic-key"
                  type={showAnthropicKey ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* OpenAI */}
          <div className={`p-4 rounded-lg border ${primaryProvider === "openai" ? "border-primary bg-primary/5" : "border-slate-200"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{providerInfo.openai.name}</h4>
                  {primaryProvider === "openai" && (
                    <Badge variant="default" className="text-xs">Primary</Badge>
                  )}
                  {openaiKey && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Configured</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{providerInfo.openai.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-sm">API Key</Label>
              <div className="relative">
                <Input
                  id="openai-key"
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Gemini */}
          <div className={`p-4 rounded-lg border ${primaryProvider === "gemini" ? "border-primary bg-primary/5" : "border-slate-200"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{providerInfo.gemini.name}</h4>
                  {primaryProvider === "gemini" && (
                    <Badge variant="default" className="text-xs">Primary</Badge>
                  )}
                  {geminiKey && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Configured</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{providerInfo.gemini.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-key" className="text-sm">API Key</Label>
              <div className="relative">
                <Input
                  id="gemini-key"
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                >
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Warning if primary provider has no key */}
        {!getKeyForProvider(primaryProvider) && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The selected primary provider ({providerInfo[primaryProvider].name}) has no API key configured. 
              AI features will not work until you add a key.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved!
              </>
            ) : (
              "Save AI Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
