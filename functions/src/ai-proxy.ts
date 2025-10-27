/**
 * AI Proxy Cloud Function for Blue Dragon Motors
 * ============================================
 *
 * This Cloud Function provides secure AI API endpoints using Gemini 1.5 Flash,
 * ensuring API keys are never exposed to the client-side application.
 *
 * Features:
 * - Gemini 1.5 Flash integration
 * - Free tier: 1,500 requests/day
 * - Cost monitoring and budget checks
 * - Rate limiting integration
 * - Error handling and graceful degradation
 * - Comprehensive logging for cost tracking
 */

import { onRequest, onCall } from 'firebase-functions/v2/https';
import { config } from 'firebase-functions/v2';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin with a specific app name to avoid conflicts
console.log('🤖 AI Proxy: Initializing Firebase Admin...');
let app;
try {
  // Check if default app already exists
  const apps = getApps();
  if (apps.length > 0) {
    console.log('🤖 AI Proxy: Using existing Firebase Admin app');
    app = apps[0];
  } else {
    console.log('🤖 AI Proxy: Creating new Firebase Admin app');
    app = initializeApp({}, 'ai-proxy-app');
  }
} catch (error) {
  console.error('🤖 AI Proxy: Failed to initialize Firebase Admin:', error);
  throw error;
}

const db = getFirestore(app);
console.log('🤖 AI Proxy: Firebase Admin initialized successfully');

// Input validation interfaces
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface AIProxyRequest {
  prompt: string;
  context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch';
  userId?: string;
}

// AIProxyResponse interface removed - using inline return types

// Cost tracking interfaces
interface DailyUsage {
  date: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  lastUpdated: Date;
}

interface BudgetCheck {
  withinBudget: boolean;
  remainingRequests: number;
  dailyLimit: number;
  currentUsage: number;
}

// Validation functions
function validateRequired(value: any, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, errors: [`${fieldName} is required`] };
  }
  return { isValid: true, errors: [] };
}

function validateString(value: any, fieldName: string, maxLength?: number): ValidationResult {
  if (typeof value !== 'string') {
    return { isValid: false, errors: [`${fieldName} must be a string`] };
  }
  if (maxLength && value.length > maxLength) {
    return { isValid: false, errors: [`${fieldName} must be less than ${maxLength} characters`] };
  }
  return { isValid: true, errors: [] };
}

function validateAIProxyRequest(body: any): ValidationResult {
  const errors: string[] = [];

  // Validate required prompt
  const promptValidation = validateRequired(body.prompt, 'prompt');
  if (!promptValidation.isValid) {
    errors.push(...promptValidation.errors);
  } else {
    const promptStrValidation = validateString(body.prompt, 'prompt', 10000);
    if (!promptStrValidation.isValid) {
      errors.push(...promptStrValidation.errors);
    }
  }

  // Validate required context
  const contextValidation = validateRequired(body.context, 'context');
  if (!contextValidation.isValid) {
    errors.push(...contextValidation.errors);
  } else {
    const validContexts = ['chatbot', 'scanner', 'workOrder', 'productSearch'];
    if (!validContexts.includes(body.context)) {
      errors.push('context must be one of: chatbot, scanner, workOrder, productSearch');
    }
  }

  // Validate optional userId
  if (body.userId !== undefined) {
    const userIdValidation = validateString(body.userId, 'userId', 100);
    if (!userIdValidation.isValid) {
      errors.push(...userIdValidation.errors);
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Helper function to get Gemini client (initialized lazily)
function getGeminiClient(): GoogleGenerativeAI {
  console.log('🤖 AI Proxy: Getting Gemini client...');
  const apiKey = config().gemini?.api_key || process.env.GEMINI_API_KEY;
  console.log('🤖 AI Proxy: API key configured:', !!apiKey);
  if (!apiKey) {
    console.error('🤖 AI Proxy: Gemini API key not configured');
    throw new Error('Gemini API key not configured');
  }
  console.log('🤖 AI Proxy: Creating Gemini client...');
  const client = new GoogleGenerativeAI(apiKey);
  console.log('🤖 AI Proxy: Gemini client created successfully');
  return client;
}

// Helper function to calculate Gemini API costs
function calculateGeminiCost(inputTokens: number, outputTokens: number): number {
  // Gemini 1.5 Flash pricing (as of 2024)
  // Input: $0.00001875 per 1K characters (approximately $0.075 per 1M tokens)
  // Output: $0.000075 per 1K characters (approximately $0.30 per 1M tokens)
  // Converting to per-token pricing for consistency
  const inputCostPerToken = 0.000075 / 1000; // $0.075 per 1M tokens = $0.000075 per 1000 tokens
  const outputCostPerToken = 0.00030 / 1000; // $0.30 per 1M tokens = $0.00030 per 1000 tokens

  const inputCost = inputTokens * inputCostPerToken;
  const outputCost = outputTokens * outputCostPerToken;

  return inputCost + outputCost;
}

// Cost tracking functions
async function trackAICall(context: string, tokens: number, cost: number, userId?: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const docRef = db.collection('ai_cost_tracking').doc(today);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const current = doc.exists ? doc.data() as DailyUsage : {
        date: today,
        requestCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastUpdated: new Date()
      };

      transaction.set(docRef, {
        ...current,
        requestCount: current.requestCount + 1,
        totalTokens: current.totalTokens + tokens,
        totalCost: current.totalCost + cost,
        lastUpdated: new Date()
      });
    });

    // Log individual call for detailed tracking
    await db.collection('ai_call_logs').add({
      context,
      tokens,
      cost,
      userId: userId || 'anonymous',
      timestamp: new Date(),
      provider: 'gemini'
    });

    console.log(`💰 AI Cost Tracking: ${context} - ${tokens} tokens - $${cost.toFixed(6)}`);
  } catch (error) {
    console.error('Error tracking AI call:', error);
    // Non-blocking error - don't fail the request
  }
}

// Budget check function
async function checkBudget(): Promise<BudgetCheck> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const docRef = db.collection('ai_cost_tracking').doc(today);
    const doc = await docRef.get();

    const FREE_TIER_LIMIT = 1500; // 1,500 requests/day free tier
    const currentUsage = doc.exists ? (doc.data() as DailyUsage).requestCount : 0;
    const remainingRequests = Math.max(0, FREE_TIER_LIMIT - currentUsage);

    return {
      withinBudget: currentUsage < FREE_TIER_LIMIT,
      remainingRequests,
      dailyLimit: FREE_TIER_LIMIT,
      currentUsage
    };
  } catch (error) {
    console.error('Error checking budget:', error);
    // Fail safe: assume within budget on error
    return {
      withinBudget: true,
      remainingRequests: 1500,
      dailyLimit: 1500,
      currentUsage: 0
    };
  }
}

// Context-specific system prompts
function getSystemPrompt(context: string): string {
  const prompts: Record<string, string> = {
    chatbot: `You are a helpful assistant for Blue Dragon Motors, a motorcycle workshop in Bogotá, Colombia.
Provide friendly, accurate responses about our services, hours, and general information.
Keep responses concise and helpful. If you don't know something, suggest contacting us directly.`,

    scanner: `You are an AI assistant helping identify motorcycle parts from images or descriptions.
Provide specific part names, compatibility information, and pricing when available.
Be precise and technical in your responses. Focus on accurate part identification.`,

    workOrder: `You are an AI assistant helping create and manage work orders for motorcycle repairs.
Provide structured recommendations for repairs, parts needed, and estimated costs.
Be professional and detailed in your technical assessments.`,

    productSearch: `You are an AI assistant helping customers find motorcycle parts and accessories.
Provide specific product recommendations with pricing and availability.
Be helpful and informative about product specifications and compatibility.`
  };

  return prompts[context] || prompts.chatbot;
}

// CORS configuration
const allowedOrigins = (config().cors?.allowed_origins || process.env.ALLOWED_ORIGINS || 'http://localhost:4200').split(',').map((s: string) => s.trim());

function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Health check endpoint
export const health = onRequest((req, res) => {
  console.log('🤖 AI Proxy: Health check called');
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    console.log('🤖 AI Proxy: Handling OPTIONS request');
    res.status(204).send('');
    return;
  }

  console.log('🤖 AI Proxy: Returning health status');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      gemini: true
    },
    uptime: process.uptime()
  });
});

// Main AI Proxy function using Gemini 1.5 Flash
export const aiProxy = onCall(async (request) => {
  console.log('🤖 AI Proxy: aiProxy function called');
  const { prompt, context, userId } = request.data as AIProxyRequest;
  console.log('🤖 AI Proxy: Request data:', { prompt: prompt?.substring(0, 100), context, userId });

  try {
    // Validate input
    console.log('🤖 AI Proxy: Validating input...');
    const validation = validateAIProxyRequest(request.data);
    if (!validation.isValid) {
      console.error('🤖 AI Proxy: Validation failed:', validation.errors);
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    console.log('🤖 AI Proxy: Input validation passed');

    // Check budget/free tier limits
    console.log('🤖 AI Proxy: Checking budget...');
    const budgetCheck = await checkBudget();
    console.log('🤖 AI Proxy: Budget check result:', budgetCheck);
    if (!budgetCheck.withinBudget) {
      console.warn(`🤖 AI Proxy: Budget exceeded: ${budgetCheck.currentUsage}/${budgetCheck.dailyLimit} requests today`);
      return {
        response: getFallbackResponse(context),
        tokens: 0,
        provider: 'fallback' as const,
        cost: 0,
        cached: false
      };
    }

    // Get Gemini client and generate response
    console.log('🤖 AI Proxy: Getting Gemini client...');
    const geminiClient = getGeminiClient();
    const systemPrompt = getSystemPrompt(context);
    console.log('🤖 AI Proxy: System prompt length:', systemPrompt.length);

    console.log('🤖 AI Proxy: Creating generative model...');
    const model = geminiClient.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      systemInstruction: systemPrompt
    });
    console.log('🤖 AI Proxy: Model created, generating content...');

    const result = await model.generateContent(prompt);
    console.log('🤖 AI Proxy: Content generated, extracting response...');
    const response = result.response.text();
    console.log('🤖 AI Proxy: Response length:', response.length);

    // Calculate tokens and cost
    const inputTokens = result.response.usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);
    const outputTokens = result.response.usageMetadata?.candidatesTokenCount || Math.ceil(response.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const cost = calculateGeminiCost(inputTokens, outputTokens);
    console.log('🤖 AI Proxy: Token calculation:', { inputTokens, outputTokens, totalTokens, cost });

    // Track the AI call
    console.log('🤖 AI Proxy: Tracking AI call...');
    await trackAICall(context, totalTokens, cost, userId);

    console.log(`🤖 AI Proxy: Success - ${context} - ${totalTokens} tokens - $${cost.toFixed(6)}`);

    return {
      response,
      tokens: totalTokens,
      provider: 'gemini' as const,
      cost,
      cached: false
    };

  } catch (error: any) {
    console.error('🤖 AI Proxy: Error occurred:', error);
    console.error('🤖 AI Proxy: Error stack:', error.stack);

    // Graceful degradation - return fallback response
    console.log('🤖 AI Proxy: Returning fallback response');
    return {
      response: getFallbackResponse(context),
      tokens: 0,
      provider: 'fallback' as const,
      cost: 0,
      cached: false
    };
  }
});

// Fallback responses for graceful degradation
function getFallbackResponse(context: string): string {
  const fallbacks: Record<string, string> = {
    chatbot: 'Lo siento, el servicio de IA no está disponible temporalmente. Para información general sobre nuestros servicios, horarios o contacto, por favor revisa nuestra página web o llámanos al +57 301 234 5678.',
    scanner: 'El escáner de IA no está disponible. Por favor describe manualmente las piezas que necesitas o contacta a un técnico para asistencia.',
    workOrder: 'El asistente de órdenes de trabajo no está disponible. Puedes crear la orden manualmente o contactar a recepción para ayuda.',
    productSearch: 'La búsqueda inteligente no está disponible. Usa el catálogo de productos estándar o contacta a un asesor para encontrar lo que necesitas.'
  };

  return fallbacks[context] || 'Servicio temporalmente no disponible. Inténtalo de nuevo más tarde.';
}

// Budget monitoring endpoint for admin dashboard
export const getBudgetStatus = onCall(async (request) => {
  console.log('🤖 AI Proxy: getBudgetStatus called');
  // This would be protected by admin authentication in production
  console.log('🤖 AI Proxy: Checking budget...');
  const budgetCheck = await checkBudget();

  // Get today's usage details
  const today = new Date().toISOString().split('T')[0];
  console.log('🤖 AI Proxy: Getting usage data for date:', today);
  const docRef = db.collection('ai_cost_tracking').doc(today);
  const doc = await docRef.get();

  const usage = doc.exists ? doc.data() as DailyUsage : {
    date: today,
    requestCount: 0,
    totalTokens: 0,
    totalCost: 0,
    lastUpdated: new Date()
  };
  console.log('🤖 AI Proxy: Usage data:', usage);

  const result = {
    ...budgetCheck,
    usage,
    costPerRequest: usage.requestCount > 0 ? usage.totalCost / usage.requestCount : 0,
    averageTokensPerRequest: usage.requestCount > 0 ? usage.totalTokens / usage.requestCount : 0
  };
  console.log('🤖 AI Proxy: getBudgetStatus result:', result);
  return result;
});

// Cost analytics endpoint for monitoring dashboard
export const getCostAnalytics = onCall(async (request) => {
  console.log('🤖 AI Proxy: getCostAnalytics called');
  const { days = 7 } = request.data || {};
  console.log('🤖 AI Proxy: Days requested:', days);

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    console.log('🤖 AI Proxy: Date range:', startDate.toISOString(), 'to', endDate.toISOString());

    const analytics: any[] = [];
    let totalRequests = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      console.log('🤖 AI Proxy: Processing date:', dateStr);

      const docRef = db.collection('ai_cost_tracking').doc(dateStr);
      const doc = await docRef.get();

      if (doc.exists) {
        const usage = doc.data() as DailyUsage;
        console.log('🤖 AI Proxy: Found usage data:', usage);
        analytics.push({
          date: dateStr,
          requestCount: usage.requestCount,
          totalTokens: usage.totalTokens,
          totalCost: usage.totalCost,
          lastUpdated: usage.lastUpdated
        });
        totalRequests += usage.requestCount;
        totalTokens += usage.totalTokens;
        totalCost += usage.totalCost;
      } else {
        console.log('🤖 AI Proxy: No usage data for date:', dateStr);
        analytics.push({
          date: dateStr,
          requestCount: 0,
          totalTokens: 0,
          totalCost: 0,
          lastUpdated: new Date()
        });
      }
    }

    const result = {
      analytics,
      summary: {
        totalRequests,
        totalTokens,
        totalCost,
        averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
        averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
        periodDays: days
      }
    };
    console.log('🤖 AI Proxy: getCostAnalytics result summary:', result.summary);
    return result;
  } catch (error) {
    console.error('🤖 AI Proxy: Error getting cost analytics:', error);
    throw new Error('Failed to retrieve cost analytics');
  }
});