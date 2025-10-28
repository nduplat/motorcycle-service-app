# IMPLEMENTATION GUIDE - Blue Dragon Motors

## Sprint 1: Foundation - Immediate 50% Cost Reduction

### Objective
Implement caching + Gemini migration to achieve immediate 50% cost reduction.

### Tasks

#### 1. Migrate ai-proxy.ts to Gemini 1.5 Flash (4h)
**Goal:** Replace OpenAI/Groq with cost-effective Gemini API.

**Steps:**
1. Update `functions/src/ai-proxy.ts` to use Gemini 1.5 Flash
2. Configure free tier (1,500 requests/day)
3. Update environment variables
4. Test API integration

**Code Changes:**
```typescript
// functions/src/ai-proxy.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export const aiProxy = functions.https.onCall(async (data, context) => {
  const { prompt, context } = data;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Estimate tokens (rough approximation)
  const tokens = Math.ceil(response.length / 4);

  return { response, tokens };
});
```

#### 2. Implement CacheService with TTLs (6h)
**Goal:** Create intelligent caching system with semantic keys.

**Steps:**
1. Create `src/services/cache.service.ts`
2. Implement semantic key generation
3. Add TTL management
4. Integrate with Firestore

**Key Implementation:**
```typescript
@Injectable({ providedIn: 'root' })
export class CacheService {
  private readonly CACHE_TTL = {
    product_search: 24 * 60 * 60 * 1000, // 24h
    chatbot_faqs: 30 * 24 * 60 * 60 * 1000, // 30d
    scanner_results: 60 * 60 * 1000, // 1h
    work_order_templates: 7 * 24 * 60 * 60 * 1000, // 7d
  };

  async get<T>(key: string): Promise<T | null> {
    const docRef = doc(this.firestore, 'ai_cache', key);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const cached = docSnap.data() as CachedResponse;
    if (this.isExpired(cached)) return null;

    return cached.data;
  }

  async set<T>(key: string, data: T, context: string): Promise<void> {
    const ttl = this.CACHE_TTL[context] || this.CACHE_TTL.general;
    const expiresAt = Timestamp.fromMillis(Date.now() + ttl);

    await setDoc(doc(this.firestore, 'ai_cache', key), {
      data,
      expiresAt,
      createdAt: Timestamp.now()
    });
  }

  private generateSemanticKey(prompt: string, context: string): string {
    const normalized = prompt.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const hash = this.simpleHash(normalized);
    return `ai:${context}:${hash}`;
  }
}
```

#### 3. Integrate Cache in AIAssistantService (4h)
**Goal:** Modify AI service to use caching layer.

**Steps:**
1. Update `src/services/ai-assistant.service.ts`
2. Add cache checks before AI calls
3. Implement fallback responses
4. Add cost tracking

**Integration Pattern:**
```typescript
async query(prompt: string, context: string, userId: string): Promise<AIResponse> {
  // 1. Check for pre-generated fallback
  const fallback = this.findFallback(prompt, context);
  if (fallback) {
    return { response: fallback, tokens: 0, cached: true, provider: 'fallback' };
  }

  // 2. Check cache
  const cacheKey = this.generateCacheKey(prompt, context);
  const cached = await this.cache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true, provider: 'gemini' };
  }

  // 3. Check rate limit
  if (!await this.rateLimiter.checkLimit(userId, context)) {
    return { response: this.getFallbackMessage(context), tokens: 0, cached: false, provider: 'fallback' };
  }

  // 4. Make AI call
  const aiResponse = await this.callGeminiAPI(prompt, context);

  // 5. Cache response
  await this.cache.set(cacheKey, aiResponse, context);

  // 6. Track cost
  await this.costMonitoring.trackAICall(context, aiResponse.tokens, 'gemini');

  return { ...aiResponse, cached: false, provider: 'gemini' };
}
```

#### 4. Basic Testing & Validation (2h)
**Goal:** Ensure cache hit rate >60% and 50% cost reduction.

**Test Cases:**
- Fallback responses work for common queries
- Cache returns results for repeated queries
- AI calls are made only for cache misses
- Rate limiting works correctly

### Sprint 1 Success Metrics
- ✅ Gemini API operational
- ✅ Cache system functional with metrics
- ✅ Integration tests passing
- ✅ 50% reduction in AI calls
- ✅ Cache hit rate >60%

---

## Sprint 2: Safety Net - Budget Protection

### Objective
Eliminate budget blow-up risk with rate limiting and monitoring.

### Tasks

#### 1. Implement Role-Based Rate Limiting (5h)
**Goal:** Prevent abuse with differentiated limits.

**Implementation:**
```typescript
@Injectable({ providedIn: 'root' })
export class RateLimiterService {
  private readonly limits = {
    technician: { chatbot: 50, scanner: 100, workOrder: 30 },
    customer: { chatbot: 5, productSearch: 10 }
  };

  async checkLimit(userId: string, feature: string): Promise<boolean> {
    const userRole = await this.auth.getUserRole(userId);
    const limit = this.limits[userRole]?.[feature] || 0;

    const usage = await this.getTodayUsage(userId, feature);
    return usage < limit;
  }
}
```

#### 2. Budget Circuit Breaker (3h)
**Goal:** Auto-disable AI when budget exceeded.

**Implementation:**
```typescript
@Injectable({ providedIn: 'root' })
export class BudgetCircuitBreakerService {
  private readonly BUDGET_LIMIT = 50; // $50/month

  async checkBudget(): Promise<boolean> {
    const currentCost = await this.costMonitoring.getCurrentMonthCost();
    const withinBudget = currentCost < this.BUDGET_LIMIT;

    if (!withinBudget) {
      await this.disableAI();
      this.toast.error('AI features disabled due to budget constraints');
    }

    return withinBudget;
  }

  private async disableAI(): Promise<void> {
    // Set all AI services to return fallback responses only
    this.aiAssistant.disableAI();
  }
}
```

#### 3. Cost Monitoring Dashboard (6h)
**Goal:** Real-time visibility into costs and alerts.

**Implementation:** See `docs/cost-monitoring-dashboard.md` for React component implementation.

#### 4. Alert System (2h)
**Goal:** Automatic notifications at 80% budget usage.

**Implementation:**
```typescript
@Injectable({ providedIn: 'root' })
export class AlertService {
  async checkAndAlert(): Promise<void> {
    const status = await this.costMonitoring.getBudgetStatus();

    if (status.percentage >= 80) {
      await this.sendAlert({
        level: status.percentage >= 100 ? 'critical' : 'warning',
        message: `Budget at ${status.percentage}%. Current: $${status.currentCost}`,
        actions: status.percentage >= 100 ? ['disable_ai'] : ['reduce_limits']
      });
    }
  }
}
```

### Sprint 2 Success Metrics
- ✅ Rate limiter operational
- ✅ Auto-shutdown at $50 budget
- ✅ Dashboard visible at `/admin/cost-monitoring`
- ✅ Email/SMS alerts functional

---

## Sprint 3: Optimization - Maximum Efficiency

### Objective
Achieve 80%+ cache hit rate and minimize residual AI costs.

### Tasks

#### 1. Expand Fallback Library (6h)
**Goal:** Pre-generate 50+ common responses.

**Implementation:**
```typescript
private readonly FALLBACK_RESPONSES = {
  chatbot: {
    'horario': 'Lunes-Viernes 8am-6pm, Sábados 9am-2pm',
    'ubicacion': 'Calle 123 #45-67, Bogotá',
    'servicios': 'Mantenimiento, Reparaciones, Repuestos...',
    // + 50 more responses
  },
  productSearch: {
    'aceite_10w40': 'Motul 10W40 - $42.000 (Stock: 15)',
    // + 20 more products
  }
};
```

#### 2. Semantic Cache Optimization (4h)
**Goal:** Improve cache hit rate with better key generation.

**Enhancements:**
- Query normalization (remove accents, punctuation)
- Synonym matching
- Context-aware TTLs

#### 3. Pre-caching Strategy (3h)
**Goal:** Cache popular queries proactively.

**Implementation:**
```typescript
async preCachePopularQueries(): Promise<void> {
  const popularQueries = [
    'horario de atención',
    'servicios disponibles',
    'precio cambio aceite',
    // etc.
  ];

  for (const query of popularQueries) {
    const response = await this.callGeminiAPI(query, 'chatbot');
    await this.cache.set(this.generateCacheKey(query, 'chatbot'), response, 'chatbot');
  }
}
```

#### 4. A/B Testing Framework (4h)
**Goal:** Validate quality of cached vs fresh responses.

**Implementation:**
```typescript
async abTestResponse(query: string, context: string): Promise<{
  cached: string;
  fresh: string;
  preference: 'cached' | 'fresh' | 'equal';
}> {
  const cached = await this.getCachedResponse(query, context);
  const fresh = await this.callGeminiAPI(query, context);

  // Return both for user comparison
  return { cached, fresh, preference: null };
}
```

### Sprint 3 Success Metrics
- ✅ Cache hit rate >80%
- ✅ 50 pre-generated FAQs
- ✅ Work order templates cached
- ✅ Quality validation reports

---

## Sprint 4: Analytics & Refinement

### Objective
Data-driven optimization and long-term sustainability.

### Tasks

#### 1. Analytics Dashboard (6h)
**Goal:** Comprehensive insights into usage patterns.

**Features:**
- Cost trends over time
- Cache performance metrics
- User behavior analysis
- Predictive cost modeling

#### 2. Cache Invalidation Strategy (4h)
**Goal:** Smart cache invalidation when data changes.

**Implementation:**
```typescript
async invalidateRelatedCache(productId: string): Promise<void> {
  // When product price changes, invalidate related cache
  const patterns = [
    `ai:productSearch:*${productId}*`,
    `ai:chatbot:*precio*${productId}*`
  ];

  for (const pattern of patterns) {
    await this.cache.invalidatePattern(pattern);
  }
}
```

#### 3. User Feedback Loop (3h)
**Goal:** Collect quality feedback on AI responses.

**Implementation:**
```typescript
// After each AI response, show feedback buttons
showFeedback(responseId: string): void {
  // "Was this helpful?" Yes/No buttons
  // Store feedback for quality analysis
}
```

#### 4. Documentation & Runbooks (4h)
**Goal:** Operational documentation for maintenance.

**Deliverables:**
- Cache management runbook
- Budget monitoring procedures
- Emergency response protocols
- Performance optimization guides

### Sprint 4 Success Metrics
- ✅ Analytics dashboard operational
- ✅ User feedback system active
- ✅ Predictive cost model functional
- ✅ Complete operational documentation

---

## Technical Implementation Notes

### Environment Setup
```bash
# Install dependencies
npm install @google/generative-ai

# Environment variables
GEMINI_API_KEY=your_api_key_here
FIREBASE_PROJECT_ID=your_project_id
```

### Deployment Checklist
- [ ] Gemini API key configured
- [ ] Firestore security rules updated for cache collection
- [ ] Cloud Functions deployed with new ai-proxy
- [ ] Cache collection created in Firestore
- [ ] Rate limiting collections initialized
- [ ] Cost monitoring collections set up

### Rollback Plan
1. **Immediate Rollback:** Comment out AI calls, use only fallbacks
2. **Partial Rollback:** Disable caching, keep rate limiting
3. **Full Rollback:** Revert to original OpenAI implementation

### Monitoring & Alerts
- **Daily:** Cache hit rate, AI call volume, cost tracking
- **Weekly:** Budget status, performance metrics
- **Monthly:** Cost analysis, optimization opportunities

This implementation guide provides a phased approach to cost optimization while maintaining system functionality and user experience.