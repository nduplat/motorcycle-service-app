
import { Provider } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { EventBusService } from '../../services/event-bus.service';
import { CostMonitoringService } from '../../services/cost-monitoring.service';
import { CacheService } from '../../services/cache.service';
import { FallbackLibraryService } from '../../services/fallback-library.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { RateLimiterService } from '../../services/rate-limiter.service';
import { ServiceHealthService } from '../../services/service-health.service';

export const MOCK_PROVIDERS: Provider[] = [
  {
    provide: Firestore,
    useValue: {},
  },
  {
    provide: EventBusService,
    useValue: {
      events$: of(),
      emit: () => {},
    },
  },
  {
    provide: CostMonitoringService,
    useValue: {
      getCurrentCosts: () => ({
        firestore: 0,
        storage: 0,
        functions: 0,
        hosting: 0,
        realtime: 0,
        total: 0,
      }),
      getUsageHistory: () => Promise.resolve([]),
    },
  },
  {
    provide: CacheService,
    useValue: {
      clearContext: () => {},
      recoverFormData: () => ({ hasRecovery: false }),
      startAutoSave: () => {},
      stopAutoSave: () => {},
    },
  },
  {
    provide: FallbackLibraryService,
    useValue: {
      findBestMatch: () => {},
      getResponseWithDynamicData: () => {},
    },
  },
  {
    provide: NotificationService,
    useValue: {
      createAdminAlert: () => {},
      addSystemNotification: () => of(null),
    },
  },
  {
    provide: HttpClient,
    useValue: {},
  },
  {
    provide: AuthService,
    useValue: {
      currentUser: () => {},
      waitForAuth: () => Promise.resolve(undefined),
    },
  },
  {
    provide: ToastService,
    useValue: {
      showToast: () => {},
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    },
  },
  {
    provide: RateLimiterService,
    useValue: {
        checkLimit: () => Promise.resolve(true),
        getLimitStatus: () => Promise.resolve({ allowed: true }),
    }
  },
  {
    provide: ServiceHealthService,
    useValue: {
        getServiceStatus: () => ({ status: 'operational' }),
    }
  }
];
