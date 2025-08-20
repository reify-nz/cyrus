# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-01-19-agent-os-integration/spec.md

## Configuration API Changes

### Extended RepositoryConfig Interface

```typescript
interface RepositoryConfig {
  // ... existing fields ...
  
  /**
   * Select which prompt system to use
   * @default 'traditional'
   */
  promptSystem?: 'traditional' | 'agent-os';
  
  /**
   * Agent OS specific configuration
   * Required when promptSystem is 'agent-os'
   */
  agentOsConfig?: AgentOSConfig;
}
```

### New AgentOSConfig Interface

```typescript
interface AgentOSConfig {
  /**
   * Path to Agent OS config.yml file
   * @example './agent-os/config.yml'
   */
  configPath?: string;
  
  /**
   * Project type from Agent OS configuration
   * @example 'default' | 'api-service' | 'web-app'
   */
  projectType?: string;
  
  /**
   * Override path for Agent OS instructions
   * @example './custom-instructions'
   */
  instructionsPath?: string;
  
  /**
   * Override path for Agent OS standards
   * @example './custom-standards'
   */
  standardsPath?: string;
  
  /**
   * Map Linear labels to Agent OS commands
   * @example { "bug": "execute-task", "feature": "create-spec" }
   */
  labelCommands?: Record<string, string>;
  
  /**
   * Custom context transformer modules
   * @example ['./transformers/linear-to-agenthos.js']
   */
  contextTransformers?: string[];
}
```

## Factory API

### PromptSystemFactory

```typescript
class PromptSystemFactory {
  /**
   * Create appropriate adapter based on repository configuration
   */
  static async createAdapter(
    repository: RepositoryConfig
  ): Promise<PromptSystemAdapter>;
  
  /**
   * Get cached adapter for repository
   */
  static getCachedAdapter(
    repositoryId: string
  ): PromptSystemAdapter | null;
  
  /**
   * Clear adapter cache
   */
  static clearCache(repositoryId?: string): void;
}
```

## Adapter API

### PromptSystemAdapter Interface

```typescript
interface PromptSystemAdapter {
  /**
   * Initialize adapter with repository configuration
   */
  initialize(config: RepositoryConfig): Promise<void>;
  
  /**
   * Prepare system prompt for Claude
   */
  prepareSystemPrompt(
    context: PromptContext
  ): Promise<string | undefined>;
  
  /**
   * Prepare user prompt for Claude
   */
  prepareUserPrompt(
    issue: LinearIssue,
    context: PromptContext
  ): Promise<{
    prompt: string;
    version?: string;
  }>;
  
  /**
   * Get tool restrictions for this context
   */
  getToolRestrictions(
    context: PromptContext
  ): string[] | 'readOnly' | 'safe' | 'all';
  
  /**
   * Handle Claude response (for Agent OS workflow management)
   */
  handleResponse(
    response: ClaudeResponse,
    context: PromptContext
  ): Promise<void>;
}
```

### PromptContext Interface

```typescript
interface PromptContext {
  repository: RepositoryConfig;
  issue: LinearIssue;
  labels: string[];
  promptType?: 'debugger' | 'builder' | 'scoper';
  attachmentManifest?: string;
  isNewSession: boolean;
  isMentionTriggered: boolean;
  sessionData?: LinearAgentSessionData;
}
```

## Error Responses

### Configuration Errors

```typescript
class PromptSystemConfigError extends Error {
  constructor(
    public repositoryId: string,
    public configField: string,
    message: string
  );
}
```

### Adapter Errors

```typescript
class PromptSystemAdapterError extends Error {
  constructor(
    public adapterType: 'traditional' | 'agent-os',
    public operation: string,
    message: string,
    public cause?: Error
  );
}
```
