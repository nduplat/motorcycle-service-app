# SYSTEM ARCHITECTURE - Blue Dragon Motors

## Overview

Blue Dragon Motors is a workshop management system built with Angular 17+ and Firebase, designed to handle motorcycle service operations for 7 technicians and ~200 customers.

## System Architecture

### 3-Layer Defense Architecture

The system implements a progressive enhancement approach with three layers of defense against costs and failures:

#### Layer 1: Intelligent Caching (Reduces 70% of AI calls)
- **Semantic cache keys** for similar queries
- **TTL-based expiration** (1h-30d depending on data type)
- **Fallback responses** for common queries
- **Rate limiting** by user role

#### Layer 2: Rate Limiting & Budget Control
- **Role-based limits**: Technicians (50/day) vs Customers (5/day)
- **Budget circuit breaker**: Auto-disable at $50/month
- **Graceful degradation**: Fallback to static responses

#### Layer 3: Cost Monitoring & Analytics
- **Real-time dashboard** with alerts
- **Predictive analytics** for cost trends
- **Automated contingency** activation

## Technology Stack

### Frontend
- **Angular 17+** with standalone components
- **Angular Signals** for reactive state management
- **Tailwind CSS** for styling
- **Firebase SDK** for backend integration

### Backend
- **Firebase Firestore** for data persistence
- **Firebase Functions** for server-side logic
- **Firebase Hosting** for deployment
- **Gemini 1.5 Flash** for AI features (with cost controls)

### Development Tools
- **Jest** for unit testing
- **Cypress** for E2E testing
- **ESLint** for code quality

## Core Components

### Services Architecture

#### Data Services
- **AuthService**: Firebase Authentication management
- **ProductService**: Inventory and product management
- **WorkOrderService**: Service job management
- **QueueService**: Customer queue management
- **UserService**: User profile management

#### Business Logic Services
- **AIAssistantService**: AI-powered assistance with cost controls
- **CacheService**: Intelligent caching system
- **RateLimiterService**: Request rate limiting
- **CostMonitoringService**: Cost tracking and analytics
- **BudgetCircuitBreakerService**: Budget protection

#### Utility Services
- **ErrorHandlerService**: Centralized error handling
- **NotificationService**: Multi-channel notifications
- **ToastService**: User feedback messages

### Component Architecture

#### Public Components
- **Login/Register**: Authentication flow
- **QueueJoin**: Customer queue entry
- **ServicesPage**: Service catalog display
- **Inventory**: Product browsing

#### Employee Components
- **EmployeeDashboard**: Unified technician interface
- **WorkOrderList**: Service job management
- **TimeTracking**: Work time recording

#### Admin Components
- **AdminDashboard**: Administrative overview
- **UserManagement**: User account management
- **ProductManagement**: Inventory administration
- **CostMonitoringDashboard**: Financial analytics

## Data Flow Architecture

### Request Flow
```
User Request → Component → Service → Cache Check → Rate Limit Check → AI Call/Fallback → Response
```

### State Management
- **Signals-based**: Reactive state with Angular Signals
- **Service-scoped**: State managed within service boundaries
- **Optimistic updates**: Immediate UI feedback with rollback on error

### Caching Strategy
- **Multi-level cache**: Browser → Firestore → AI API
- **Semantic keys**: Normalized query matching
- **TTL management**: Time-based expiration with context awareness

## Security Architecture

### Authentication
- **Firebase Auth**: Email/password and OAuth (Google/Apple)
- **Role-based access**: Admin, Technician, Customer roles
- **Route guards**: Automatic redirection based on permissions

### Authorization
- **Service-level checks**: Permission validation in services
- **UI-level hiding**: Component visibility based on roles
- **API-level enforcement**: Backend permission checks

### Data Security
- **Firestore rules**: Document-level security
- **Real-time updates**: Secure WebSocket connections
- **Input validation**: Client and server-side validation

## Performance Architecture

### Optimization Strategies
- **Lazy loading**: Route-based code splitting
- **Bundle optimization**: Tree shaking and minification
- **Image optimization**: WebP format with fallbacks
- **Caching layers**: Multi-tier caching system

### Monitoring
- **Performance metrics**: Core Web Vitals tracking
- **Error tracking**: Centralized error reporting
- **Cost monitoring**: Real-time budget tracking
- **User analytics**: Usage pattern analysis

## Deployment Architecture

### CI/CD Pipeline
- **GitHub Actions**: Automated testing and deployment
- **Firebase Hosting**: Global CDN deployment
- **Functions deployment**: Automated serverless deployment
- **Environment management**: Dev/Staging/Prod separation

### Infrastructure
- **Firebase Hosting**: Static asset serving
- **Cloud Functions**: Server-side processing
- **Firestore**: NoSQL database
- **Firebase Storage**: File storage

## Cost Optimization Architecture

### Budget Controls
- **Free tier utilization**: Gemini 1.5 Flash (1,500 requests/day)
- **Request batching**: Multiple operations in single calls
- **Caching effectiveness**: 80%+ cache hit rate target
- **Rate limiting**: Prevent abuse and control costs

### Monitoring Dashboard
- **Real-time metrics**: Current spending vs budget
- **Trend analysis**: Cost prediction and alerts
- **Optimization recommendations**: Automated suggestions
- **Contingency triggers**: Automatic cost reduction

## Scalability Considerations

### Horizontal Scaling
- **Stateless services**: Easy replication
- **CDN distribution**: Global performance
- **Database sharding**: Firestore automatic scaling
- **Function concurrency**: Auto-scaling serverless

### Vertical Scaling
- **Bundle size optimization**: Code splitting strategies
- **Image optimization**: Responsive images
- **Caching strategies**: Reduce server load
- **Database optimization**: Query optimization

## Error Handling Architecture

### Error Boundaries
- **Global error handler**: Catch-all error processing
- **Component error boundaries**: Isolated failure recovery
- **Service error handling**: Consistent error responses
- **User feedback**: Clear error messaging

### Recovery Strategies
- **Graceful degradation**: Fallback to basic functionality
- **Offline support**: Service worker caching
- **Retry logic**: Automatic retry with exponential backoff
- **Fallback responses**: Pre-defined responses for failures

## Testing Architecture

### Unit Testing
- **Service testing**: Business logic validation
- **Component testing**: UI interaction testing
- **Utility testing**: Helper function validation
- **Mock services**: Isolated testing environment

### Integration Testing
- **API integration**: Firebase service testing
- **Component integration**: Inter-component communication
- **End-to-end flows**: Complete user journey testing
- **Performance testing**: Load and stress testing

## Future Architecture Considerations

### Microservices Migration
- **Service extraction**: Independent deployment units
- **API gateway**: Centralized request routing
- **Event-driven architecture**: Asynchronous communication
- **Container orchestration**: Kubernetes deployment

### Advanced Features
- **Real-time collaboration**: Multi-user editing
- **Advanced analytics**: ML-powered insights
- **Mobile application**: Native mobile apps
- **IoT integration**: Connected workshop equipment

This architecture provides a solid foundation for the workshop management system while maintaining cost-effectiveness and scalability for the target user base.