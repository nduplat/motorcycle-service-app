graph TB
    subgraph "Cliente (Angular)"
        A[Usuario] --> B[AI Assistant Service]
        B --> C{Cache Check}
        C -->|Hit| D[Respuesta Instantánea]
        C -->|Miss| E{Fallback Match?}
        E -->|Sí| F[Respuesta Pre-generada]
        E -->|No| G{Rate Limit OK?}
        G -->|No| H[Degradación Graceful]
        G -->|Sí| I[Cloud Function Call]
    end

    subgraph "Firebase Services"
        I --> J[AI Proxy Function]
        J --> K{Budget Check}
        K -->|Excedido| L[Error + Alerta]
        K -->|OK| M[Gemini API Call]
        M --> N[Procesar Respuesta]
        N --> O[Cache Response]
        O --> P[Log Métricas]
        P --> Q[Firestore: ai_usage_logs]
        P --> R[Firestore: ai_budget]
        P --> S[Firestore: rate_limits]
    end

    subgraph "Gemini API"
        M --> T[Gemini 1.5 Flash]
        T -->|Free Tier| U[1,500 req/día GRATIS]
        T -->|Paid| V[$0.075/1M tokens]
    end

    subgraph "Monitoreo"
        Q --> W[Cost Dashboard]
        R --> W
        S --> W
        W --> X[Alertas Automáticas]
        X -->|>80% budget| Y[Notificación Admin]
    end

    subgraph "Optimizaciones"
        Z1[Cache Layer<br/>TTL: 1h-30d] -.->|70% reducción| C
        Z2[Fallback Responses<br/>FAQs pre-generadas] -.->|15% reducción| E
        Z3[Rate Limiting<br/>Por usuario/contexto] -.->|10% reducción| G
        Z4[Budget Circuit Breaker<br/>Auto-disable >$50] -.->|Protección| K
    end

    style A fill:#e1f5ff
    style D fill:#c3f0c3
    style F fill:#c3f0c3
    style H fill:#ffe0b2
    style L fill:#ffcccb
    style T fill:#e1bee7
    style W fill:#fff9c4
    style Y fill:#ff8a80