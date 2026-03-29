import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Zap,
  Edit3,
  Check,
  RefreshCw,
  Bot,
  User,
  ChevronRight,
} from 'lucide-react';
import { Layout } from '@/components/layout';
import { SpecialtyBadge } from '@/components/ui';
import {
  agentBuilderAPI,
  agentsAPI,
  ConversationMessage,
  GeneratedInstructions,
} from '@/lib/api';
import { cn, getSpecialtyIcon } from '@/lib/utils';
import type { AgentSpecialty } from '@/types';

type CreationStep = 'specialty' | 'chat' | 'preview' | 'finalize';

const SPECIALTIES: { value: AgentSpecialty; label: string; description: string }[] = [
  { value: 'designer', label: 'Designer', description: 'Visual design, UI/UX, branding, logos' },
  { value: 'coder', label: 'Coder', description: 'Software development, APIs, bug fixes' },
  { value: 'writer', label: 'Writer', description: 'Content creation, copywriting, docs' },
  { value: 'data_analyst', label: 'Data Analyst', description: 'Analytics, visualization, ML' },
  { value: 'tester', label: 'Tester', description: 'QA, automation, security testing' },
];

export function CreateAgentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<CreationStep>('specialty');
  const [specialty, setSpecialty] = useState<AgentSpecialty | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [generatedInstructions, setGeneratedInstructions] = useState<GeneratedInstructions | null>(null);
  const [agentName, setAgentName] = useState('');
  const [editingAuction, setEditingAuction] = useState(false);
  const [editingBarter, setEditingBarter] = useState(false);
  const [auctionInstructions, setAuctionInstructions] = useState('');
  const [barterInstructions, setBarterInstructions] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat step starts
  useEffect(() => {
    if (step === 'chat') {
      inputRef.current?.focus();
    }
  }, [step]);

  // Start chat with initial prompt when specialty is selected
  const handleSelectSpecialty = async (selected: AgentSpecialty) => {
    setSpecialty(selected);
    setIsLoading(true);

    try {
      const response = await agentBuilderAPI.getInitialPrompt(selected);
      setMessages([{ role: 'assistant', content: response.message }]);
      setStep('chat');
    } catch (error) {
      console.error('Failed to get initial prompt:', error);
      // Fallback prompt
      setMessages([{
        role: 'assistant',
        content: `Tell me about the ${selected} agent you want to create! What kind of strategy do you envision?`,
      }]);
      setStep('chat');
    } finally {
      setIsLoading(false);
    }
  };

  // Send a message in the chat
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !specialty) return;

    const userMessage: ConversationMessage = { role: 'user', content: inputValue.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await agentBuilderAPI.chat(newMessages, specialty);
      setMessages([...newMessages, { role: 'assistant', content: response.message }]);
      setReadyToGenerate(response.ready_to_generate);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, I had trouble processing that. Could you try again?' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate instructions from conversation
  const handleGenerate = async () => {
    if (!specialty) return;
    setIsLoading(true);

    try {
      const instructions = await agentBuilderAPI.generate(messages, specialty);
      setGeneratedInstructions(instructions);
      setAgentName(instructions.suggested_name);
      setAuctionInstructions(instructions.auction_instructions);
      setBarterInstructions(instructions.barter_instructions);
      setStep('preview');
    } catch (error) {
      console.error('Generation error:', error);
      // Add error message to chat
      setMessages([
        ...messages,
        { role: 'assistant', content: 'I had trouble generating the instructions. Let me try again - could you summarize what kind of agent you want?' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate with feedback
  const handleRegenerate = async (feedback: string) => {
    if (!generatedInstructions || !specialty) return;
    setIsLoading(true);

    try {
      const newInstructions = await agentBuilderAPI.refine(
        generatedInstructions,
        feedback,
        specialty
      );
      setGeneratedInstructions(newInstructions);
      setAuctionInstructions(newInstructions.auction_instructions);
      setBarterInstructions(newInstructions.barter_instructions);
    } catch (error) {
      console.error('Refinement error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create the agent
  const handleCreateAgent = async () => {
    if (!specialty || !agentName.trim()) return;
    setIsCreating(true);

    try {
      // Use authenticated agents API - user_id is set automatically from JWT
      await agentsAPI.create({
        name: agentName.trim(),
        specialty,
        auction_instructions: auctionInstructions,
        barter_instructions: barterInstructions,
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Creation error:', error);
      setIsCreating(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              if (step === 'specialty') navigate('/dashboard');
              else if (step === 'chat') setStep('specialty');
              else if (step === 'preview') setStep('chat');
              else setStep('preview');
            }}
            className="btn-ghost p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Create Agent</h1>
            <p className="text-text-secondary">
              {step === 'specialty' && 'Choose a specialty for your agent'}
              {step === 'chat' && 'Describe your ideal agent strategy'}
              {step === 'preview' && 'Review generated instructions'}
              {step === 'finalize' && 'Finalize your agent'}
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['specialty', 'chat', 'preview', 'finalize'] as CreationStep[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  step === s
                    ? 'bg-accent-purple text-white'
                    : ['specialty', 'chat', 'preview', 'finalize'].indexOf(step) > i
                    ? 'bg-accent-green text-white'
                    : 'bg-background-tertiary text-text-muted'
                )}
              >
                {['specialty', 'chat', 'preview', 'finalize'].indexOf(step) > i ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <ChevronRight className="h-4 w-4 mx-2 text-text-muted" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Specialty Selection */}
        {step === 'specialty' && (
          <div className="max-w-3xl mx-auto">
            <div className="grid gap-4">
              {SPECIALTIES.map((spec) => (
                <button
                  key={spec.value}
                  onClick={() => handleSelectSpecialty(spec.value)}
                  disabled={isLoading}
                  className="card p-6 text-left hover:border-accent-purple/50 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{getSpecialtyIcon(spec.value)}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent-purple transition-colors">
                        {spec.label}
                      </h3>
                      <p className="text-text-secondary">{spec.description}</p>
                    </div>
                    <ChevronRight className="h-6 w-6 text-text-muted group-hover:text-accent-purple transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Chat Interface */}
        {step === 'chat' && specialty && (
          <div className="max-w-3xl mx-auto">
            <div className="card overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-background-tertiary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-accent-purple" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">Agent Builder AI</h3>
                    <p className="text-xs text-text-muted flex items-center gap-2">
                      Creating a <SpecialtyBadge specialty={specialty} size="sm" />
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-3',
                      msg.role === 'user' ? 'flex-row-reverse' : ''
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        msg.role === 'user'
                          ? 'bg-accent-cyan/20'
                          : 'bg-accent-purple/20'
                      )}
                    >
                      {msg.role === 'user' ? (
                        <User className="h-4 w-4 text-accent-cyan" />
                      ) : (
                        <Bot className="h-4 w-4 text-accent-purple" />
                      )}
                    </div>
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-2 max-w-[80%]',
                        msg.role === 'user'
                          ? 'bg-accent-cyan/10 text-text-primary'
                          : 'bg-background-tertiary text-text-primary'
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-accent-purple" />
                    </div>
                    <div className="bg-background-tertiary rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce [animation-delay:0.1s]" />
                        <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce [animation-delay:0.2s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Describe your agent's strategy..."
                    className="flex-1 bg-background-tertiary border border-border rounded-lg px-4 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="btn-primary px-4"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                {/* Generate Button */}
                {(readyToGenerate || messages.length >= 4) && (
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full mt-4 btn-primary bg-gradient-to-r from-accent-purple to-accent-cyan"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Agent Instructions
                  </button>
                )}
              </div>
            </div>

            {/* Quick Generate Option */}
            <div className="mt-6 text-center">
              <p className="text-text-muted text-sm mb-2">Or skip the conversation</p>
              <button
                onClick={() => setStep('preview')}
                className="text-accent-purple hover:underline text-sm"
              >
                <Zap className="inline h-4 w-4 mr-1" />
                Quick generate with a brief description
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Edit */}
        {step === 'preview' && specialty && (
          <div className="max-w-4xl mx-auto">
            {/* Quick Generate Form (if no generated instructions yet) */}
            {!generatedInstructions && (
              <QuickGenerateForm
                specialty={specialty}
                onGenerate={(instructions) => {
                  setGeneratedInstructions(instructions);
                  setAgentName(instructions.suggested_name);
                  setAuctionInstructions(instructions.auction_instructions);
                  setBarterInstructions(instructions.barter_instructions);
                }}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            )}

            {/* Generated Instructions Preview */}
            {generatedInstructions && (
              <div className="space-y-6">
                {/* Agent Name */}
                <div className="card p-6">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full bg-background-tertiary border border-border rounded-lg px-4 py-3 text-xl font-semibold text-text-primary focus:outline-none focus:border-accent-purple"
                    placeholder="Enter agent name..."
                  />
                  <p className="mt-2 text-sm text-text-muted">
                    {generatedInstructions.personality_summary}
                  </p>
                </div>

                {/* Auction Instructions */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                      <Zap className="h-5 w-5 text-accent-orange" />
                      Auction Strategy
                    </h3>
                    <button
                      onClick={() => setEditingAuction(!editingAuction)}
                      className="btn-ghost text-sm"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      {editingAuction ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  {editingAuction ? (
                    <textarea
                      value={auctionInstructions}
                      onChange={(e) => setAuctionInstructions(e.target.value)}
                      className="w-full h-48 bg-background-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent-purple resize-none"
                    />
                  ) : (
                    <p className="text-text-secondary whitespace-pre-wrap">
                      {auctionInstructions}
                    </p>
                  )}
                </div>

                {/* Barter Instructions */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                      <RefreshCw className="h-5 w-5 text-accent-cyan" />
                      Barter Strategy
                    </h3>
                    <button
                      onClick={() => setEditingBarter(!editingBarter)}
                      className="btn-ghost text-sm"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      {editingBarter ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  {editingBarter ? (
                    <textarea
                      value={barterInstructions}
                      onChange={(e) => setBarterInstructions(e.target.value)}
                      className="w-full h-48 bg-background-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent-purple resize-none"
                    />
                  ) : (
                    <p className="text-text-secondary whitespace-pre-wrap">
                      {barterInstructions}
                    </p>
                  )}
                </div>

                {/* Regenerate Section */}
                <div className="card p-6">
                  <h4 className="font-medium text-text-primary mb-3">Want to adjust?</h4>
                  <RegenerateForm
                    onRegenerate={handleRegenerate}
                    isLoading={isLoading}
                  />
                </div>

                {/* Create Button */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('chat')}
                    className="btn-secondary flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Chat
                  </button>
                  <button
                    onClick={handleCreateAgent}
                    disabled={!agentName.trim() || isCreating}
                    className="btn-primary flex-1 bg-gradient-to-r from-accent-green to-accent-cyan"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Create Agent
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

// Quick Generate Form Component
function QuickGenerateForm({
  specialty,
  onGenerate,
  isLoading,
  setIsLoading,
}: {
  specialty: AgentSpecialty;
  onGenerate: (instructions: GeneratedInstructions) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}) {
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!description.trim() || description.length < 10) return;
    setIsLoading(true);

    try {
      const instructions = await agentBuilderAPI.quickGenerate(description, specialty);
      onGenerate(instructions);
    } catch (error) {
      console.error('Quick generation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center">
          <Zap className="h-5 w-5 text-accent-purple" />
        </div>
        <div>
          <h3 className="font-semibold text-text-primary">Quick Generate</h3>
          <p className="text-sm text-text-muted">
            Describe your agent in a few sentences
          </p>
        </div>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Example: I want an aggressive agent that undercuts competitors by 20%, focuses on high-value jobs, and isn't afraid to take risks. Should be selective about barter trades, only accepting premium exchanges..."
        className="w-full h-32 bg-background-tertiary border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple resize-none mb-4"
      />

      <button
        onClick={handleSubmit}
        disabled={description.length < 10 || isLoading}
        className="w-full btn-primary"
      >
        {isLoading ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Instructions
          </>
        )}
      </button>
    </div>
  );
}

// Regenerate Form Component
function RegenerateForm({
  onRegenerate,
  isLoading,
}: {
  onRegenerate: (feedback: string) => void;
  isLoading: boolean;
}) {
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    if (feedback.trim().length < 5) return;
    onRegenerate(feedback);
    setFeedback('');
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="e.g., Make it more aggressive, focus on volume..."
        className="flex-1 bg-background-tertiary border border-border rounded-lg px-4 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple"
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <button
        onClick={handleSubmit}
        disabled={feedback.length < 5 || isLoading}
        className="btn-secondary"
      >
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
