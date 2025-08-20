# PRD: Agent OS Integration for Edge Worker

## Executive Summary

This document outlines the requirements for integrating [Agent OS](https://github.com/buildermethods/agent-os) as an alternative prompt system alongside the existing edge-worker prompts infrastructure. The goal is to provide users with the flexibility to choose between the traditional template-based prompt system and Agent OS's structured workflow approach without breaking existing functionality.

## Problem Statement

The current edge-worker system uses static prompt templates (debugger.md, builder.md, scoper.md) that provide instructions to Claude. While effective, this approach has limitations:

1. **Limited Structure**: Prompts are single monolithic documents with embedded instructions
2. **No Workflow Management**: Lack of structured workflows and sub-agent orchestration
3. **Static Behavior**: Limited ability to dynamically adjust agent behavior based on context
4. **Manual Coordination**: No built-in support for complex multi-step workflows

Agent OS offers a more sophisticated approach with:
- Structured workflows and instruction sets
- Sub-agent orchestration
- Dynamic context management
- Built-in task tracking and execution patterns

## Goals & Success Metrics

### Primary Goals
1. **Add Agent OS Support**: Enable repositories to use Agent OS instead of traditional prompts
2. **Maintain Compatibility**: Ensure existing prompt-based workflows continue working
3. **Configuration Flexibility**: Allow per-repository or global configuration
4. **Seamless Migration**: Provide path for gradual adoption

### Success Metrics
- Zero breaking changes to existing functionality
- Configuration changes require < 5 lines of code
- Agent OS integration passes all existing tests
- Performance overhead < 5% when using Agent OS
- Clear documentation and migration guide

## User Stories

### Story 1: Repository Administrator Adopts Agent OS
As a repository administrator, I want to enable Agent OS for my repository so that I can leverage structured workflows and improved agent coordination.

**Workflow:**
1. Admin updates repository configuration to set `promptSystem: "agent-os"`
2. Admin provides path to Agent OS configuration
3. System automatically uses Agent OS instructions instead of traditional prompts
4. Existing Linear webhook integrations continue working seamlessly

### Story 2: Developer Maintains Multiple Prompt Systems
As a developer managing multiple repositories, I want some repositories to use traditional prompts and others to use Agent OS, so that I can gradually migrate without disrupting existing workflows.

**Workflow:**
1. Developer configures Repository A with traditional prompts
2. Developer configures Repository B with Agent OS
3. Both repositories function correctly with their respective systems
4. Developer can switch between systems via configuration

### Story 3: Operations Team Monitors Performance
As an operations team member, I want to monitor and compare performance between traditional prompts and Agent OS, so that I can make informed decisions about which system to use.

**Workflow:**
1. Ops team enables metrics collection for both systems
2. System logs prompt type used for each session
3. Performance metrics are comparable between systems
4. Clear reporting on system usage and performance

## Requirements

### Functional Requirements

#### 1. Configuration System
- Add `promptSystem` field to RepositoryConfig interface
  - Values: `"traditional"` (default) | `"agent-os"`
- Add `agentOsConfig` field for Agent OS specific configuration
  - `configPath`: Path to Agent OS config.yml
  - `projectType`: Agent OS project type to use
  - `instructionsPath`: Override path for instructions
  - `standardsPath`: Override path for standards

#### 2. Prompt System Adapter
- Create `PromptSystemAdapter` interface with methods:
  - `prepareSystemPrompt(context)`: Generate system prompt
  - `prepareUserPrompt(context)`: Generate user prompt
  - `getToolRestrictions(context)`: Return allowed tools
  - `handleResponse(response)`: Process agent responses

#### 3. Traditional Prompt Adapter
- Implement adapter for existing prompt system
- Wrap current `buildPromptV2`, `buildLabelBasedPrompt`, etc.
- Maintain exact current behavior

#### 4. Agent OS Adapter
- Implement adapter for Agent OS integration
- Load Agent OS configuration and instructions
- Transform Linear issues into Agent OS context
- Map Agent OS workflows to edge-worker behavior

#### 5. Runtime Selection
- Modify EdgeWorker to select appropriate adapter
- Lazy load adapters based on configuration
- Cache adapter instances per repository

### Non-Functional Requirements

#### 1. Performance
- Adapter selection overhead < 1ms
- Agent OS instruction loading cached in memory
- No performance degradation for traditional prompts

#### 2. Compatibility
- All existing tests must pass unchanged
- No changes required to existing configurations
- Backward compatible with all edge-worker versions

#### 3. Maintainability
- Clear separation between prompt systems
- Shared interfaces for common functionality
- Comprehensive test coverage for both adapters

## Technical Design

### Architecture Overview

```
EdgeWorker
    │
    ├── PromptSystemFactory
    │       ├── Creates appropriate adapter based on config
    │       └── Manages adapter lifecycle
    │
    ├── PromptSystemAdapter (Interface)
    │       ├── prepareSystemPrompt()
    │       ├── prepareUserPrompt()
    │       ├── getToolRestrictions()
    │       └── handleResponse()
    │
    ├── TraditionalPromptAdapter
    │       ├── Uses existing prompt templates
    │       ├── Wraps current prompt methods
    │       └── Maintains current behavior
    │
    └── AgentOSAdapter
            ├── Loads Agent OS configuration
            ├── Manages instruction sets
            ├── Handles workflow execution
            └── Maps to edge-worker context
```

### Configuration Schema

```typescript
interface RepositoryConfig {
  // ... existing fields ...
  
  // Prompt system selection
  promptSystem?: 'traditional' | 'agent-os';
  
  // Agent OS specific configuration
  agentOsConfig?: {
    // Path to Agent OS config.yml
    configPath?: string;
    
    // Project type from Agent OS config
    projectType?: string;
    
    // Override instructions path
    instructionsPath?: string;
    
    // Override standards path
    standardsPath?: string;
    
    // Map Linear labels to Agent OS commands
    labelCommands?: {
      [label: string]: string; // e.g., "bug": "execute-task"
    };
    
    // Custom context transformers
    contextTransformers?: string[];
  };
}
```

### Implementation Classes

```typescript
// Base interface
interface PromptSystemAdapter {
  initialize(config: RepositoryConfig): Promise<void>;
  
  prepareSystemPrompt(context: PromptContext): Promise<string>;
  
  prepareUserPrompt(
    issue: LinearIssue,
    context: PromptContext
  ): Promise<{ prompt: string; version?: string }>;
  
  getToolRestrictions(
    context: PromptContext
  ): string[] | 'readOnly' | 'safe' | 'all';
  
  handleResponse(
    response: ClaudeResponse,
    context: PromptContext
  ): Promise<void>;
}

// Context passed to adapters
interface PromptContext {
  repository: RepositoryConfig;
  issue: LinearIssue;
  labels: string[];
  promptType?: 'debugger' | 'builder' | 'scoper';
  attachmentManifest?: string;
  isNewSession: boolean;
  isMentionTriggered: boolean;
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
1. Create PromptSystemAdapter interface
2. Implement TraditionalPromptAdapter
3. Refactor EdgeWorker to use adapter pattern
4. Ensure all tests pass with refactored code

### Phase 2: Agent OS Integration (Week 3-4)
1. Implement AgentOSAdapter
2. Add Agent OS configuration loading
3. Create instruction set mappers
4. Implement workflow execution

### Phase 3: Testing & Documentation (Week 5)
1. Add comprehensive tests for both adapters
2. Create integration tests
3. Write migration documentation
4. Create example configurations

### Phase 4: Rollout (Week 6)
1. Beta test with selected repositories
2. Gather feedback and iterate
3. Full rollout with feature flag
4. Monitor performance metrics

## Risks & Mitigations

### Risk 1: Breaking Changes
- **Risk**: Refactoring might break existing functionality
- **Mitigation**: Extensive test coverage, gradual refactoring, feature flags

### Risk 2: Performance Impact
- **Risk**: Agent OS overhead affects response times
- **Mitigation**: Lazy loading, caching, performance benchmarks

### Risk 3: Complex Migration
- **Risk**: Users struggle to migrate to Agent OS
- **Mitigation**: Clear documentation, migration tools, examples

### Risk 4: Maintenance Burden
- **Risk**: Supporting two systems increases complexity
- **Mitigation**: Shared interfaces, clear separation, automated testing

## Acceptance Criteria

1. **Configuration Works**
   - Can enable Agent OS via repository config
   - Traditional prompts remain default
   - Configuration validates correctly

2. **Both Systems Function**
   - Traditional prompts work unchanged
   - Agent OS instructions execute properly
   - No performance degradation

3. **Testing Complete**
   - All existing tests pass
   - New adapter tests provide 90%+ coverage
   - Integration tests cover both systems

4. **Documentation Ready**
   - README updated with configuration options
   - Migration guide created
   - Agent OS examples provided

5. **Monitoring Enabled**
   - Prompt system type logged
   - Performance metrics collected
   - Error handling comprehensive

## Alternative Approaches Considered

### 1. Full Migration to Agent OS
- **Pros**: Single system, full Agent OS benefits
- **Cons**: Breaking change, forced migration
- **Decision**: Rejected due to compatibility requirements

### 2. Plugin System
- **Pros**: More extensible, supports other systems
- **Cons**: Over-engineering, complex API
- **Decision**: Deferred to future enhancement

### 3. Hybrid Approach
- **Pros**: Use both systems simultaneously
- **Cons**: Complex coordination, unclear behavior
- **Decision**: Rejected for simplicity

## Open Questions

1. Should we support custom Agent OS subagents?
2. How do we handle Agent OS version updates?
3. Should we provide Agent OS template generators?
4. What metrics are most important for comparison?

## Appendix

### Example Configuration

```typescript
// Traditional prompt system (default)
const traditionalRepo: RepositoryConfig = {
  id: 'frontend',
  name: 'Frontend App',
  // ... other config ...
  // promptSystem not specified, defaults to 'traditional'
};

// Agent OS system
const agentOsRepo: RepositoryConfig = {
  id: 'backend',
  name: 'Backend API',
  // ... other config ...
  promptSystem: 'agent-os',
  agentOsConfig: {
    configPath: './agent-os/config.yml',
    projectType: 'api-service',
    labelCommands: {
      'bug': 'execute-task',
      'feature': 'create-spec',
      'prd': 'analyze-product'
    }
  }
};
```

### References
- [Agent OS Documentation](https://buildermethods.com/agent-os)
- [Agent OS GitHub Repository](https://github.com/buildermethods/agent-os)
- Current EdgeWorker Documentation
- Linear API Documentation
