

/**
 * DEPRECATED: Gemini AI Service
 *
 * This service has been removed from the application as per security and architecture review.
 * All AI functionality now uses Groq AI through a secure backend proxy.
 *
 * If you need image analysis capabilities, consider implementing them through Groq's vision models
 * or other secure AI services via the backend proxy architecture.
 *
 * @deprecated Use GroqService for all AI operations
 */
export class GeminiService {
  isConfigured(): boolean {
    return false;
  }

  async identifyProduct(base64Image: string): Promise<any> {
    throw new Error('Gemini AI service has been deprecated. Use Groq AI service instead.');
  }
}