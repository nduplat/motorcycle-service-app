import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable, HttpsCallableResult } from '@angular/fire/functions';
import { from, Observable } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { CostMonitoringService } from './cost-monitoring.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private functions: Functions = inject(Functions);
  private costMonitoringService = inject(CostMonitoringService);

  /**
   * Generic method to call a Firebase Cloud Function.
   * @param functionName The name of the callable function to execute.
   * @param data The data to pass to the function.
   * @returns An Observable with the result of the function call.
   */
  public callFunction<T>(functionName: string, data: any): Observable<T> {
    const callable = httpsCallable(this.functions, functionName);

    console.log(`[ApiService] Calling function '${functionName}' with data:`, data);

    this.costMonitoringService.trackFunctionInvocation();

    return from(callable(data) as Promise<HttpsCallableResult<T>>).pipe(
      tap(result => {
        console.log(`[ApiService] Function '${functionName}' returned:`, result.data);
      }),
      map(result => result.data),
      catchError(error => {
        console.error(`[ApiService] Error calling function '${functionName}':`, {
          code: error.code,
          message: error.message,
          details: error.details
        });
        // Re-throw the error to be handled by the calling service
        throw error;
      })
    );
  }
}
