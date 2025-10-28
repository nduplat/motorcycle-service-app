# Blue Dragon Motors - Documentation

## Overview

This documentation provides comprehensive information about the Blue Dragon Motors workshop management system, including system architecture, API documentation, implementation guides, and operational procedures.

## Documentation Structure

### Core Documentation Files

| File | Description | Status |
|------|-------------|--------|
| [`AUDIT_REPORT.md`](AUDIT_REPORT.md) | Complete audit findings from codebase analysis | ✅ Current |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture and design principles | ✅ Current |
| [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) | Complete API reference for all services | ✅ Current |
| [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) | Step-by-step implementation instructions | ✅ Current |

### Implementation Files

| File | Description | Purpose |
|------|-------------|---------|
| [`implementation-plan.md`](implementation-plan.md) | Sprint-based implementation plan | Planning |
| [`implementation-roadmap.md`](implementation-roadmap.md) | High-level roadmap | Planning |
| [`architecture-decision-records.md`](architecture-decision-records.md) | Key architectural decisions | Reference |
| [`design-principles.md`](design-principles.md) | Design principles and lessons learned | Reference |
| [`cost-monitoring-dashboard.md`](cost-monitoring-dashboard.md) | Cost monitoring dashboard component | Reference |
| [`system-architecture-diagram.md`](system-architecture-diagram.md) | Architecture diagrams | Reference |
| [`testing-validation.md`](testing-validation.md) | Testing strategies and validation | Reference |

### Project Structure

| File | Description | Purpose |
|------|-------------|---------|
| [`project-tree.md`](project-tree.md) | Complete project file structure | Reference |

## Quick Start

1. **Read the Architecture** - Start with [`ARCHITECTURE.md`](ARCHITECTURE.md) to understand system design
2. **Review API Documentation** - Check [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) for service details
3. **Follow Implementation Guide** - Use [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) for technical details
4. **Check Audit Report** - Review [`AUDIT_REPORT.md`](AUDIT_REPORT.md) for current system state

## Key System Information

### Architecture Overview
- **Frontend**: Angular 17+ with standalone components and Signals
- **Backend**: Firebase (Firestore, Functions, Hosting)
- **AI Integration**: Gemini 1.5 Flash with cost optimization
- **Authentication**: Firebase Auth with role-based access
- **State Management**: Angular Signals with reactive patterns

### Cost Optimization
- **3-Layer Defense**: Fallback → Cache → AI
- **Role-Based Limits**: Technicians (50/day) vs Customers (5/day)
- **Budget Circuit Breaker**: Auto-disable at $50/month
- **Semantic Caching**: 80%+ hit rate target

### Current State
- **Codebase Quality**: Medium-High (audit completed October 2024)
- **Main Issues**: Large components need refactoring, obsolete models removed
- **Active Services**: 25+ services with comprehensive CRUD operations
- **User Base**: 7 employees + ~200 customers

## Naming Conventions

### File Naming
- **Core docs**: `SCREAMING_SNAKE_CASE.md` (AUDIT_REPORT.md, ARCHITECTURE.md)
- **Implementation**: `kebab-case.md` (implementation-guide.md)
- **Components**: `PascalCase.md` (CostMonitoringDashboard.md)

### Content Organization
- **Headers**: Use `#` for main sections, `##` for subsections
- **Code blocks**: Use TypeScript/JavaScript syntax highlighting
- **Tables**: Use markdown tables for structured data
- **Links**: Use relative links to other documentation files

## Maintenance

### Updating Documentation
1. **Core files** should be updated when system changes occur
2. **Implementation files** should be updated after each sprint
3. **New files** should follow established naming conventions

### Review Process
- **Monthly**: Review all core documentation for accuracy
- **After changes**: Update relevant documentation sections
- **Before releases**: Ensure implementation guides are current

## Support

For questions about this documentation:
- Check the relevant section in the files above
- Review the audit report for context on decisions
- Refer to implementation guide for technical details

---

*Last updated: Documentation cleanup completed October 2024*
*Next review: Monthly*