# Agent OS Configuration System

## Overview

The Agent OS adapter supports a hierarchical configuration system that allows for flexible management of workflows and prompts. Configurations can be defined at multiple levels, with more specific configurations overriding more general ones.

## Configuration Hierarchy

The Agent OS adapter loads and merges configurations from three sources in the following order:

1. **Global Configuration** (`~/.agent-os/config.json`)
   - User-wide default configurations
   - Shared across all projects
   - Good for personal preferences and common workflows

2. **Local Project Configuration** (`.agent-os/config.json`)
   - Project-specific configurations
   - Searched upward from the repository path
   - Overrides global settings for the project

3. **Repository-Specific Overrides** (in repository config)
   - Inline configuration in the repository settings
   - Highest priority, overrides all other configurations
   - Good for repository-specific customizations

## Configuration Loading Process

### 1. Global Configuration Loading
```javascript
// Loads from ~/.agent-os/config.json
const globalConfig = await this.loadConfigFromPath(
    path.join(os.homedir(), ".agent-os", "config.json")
);
```

### 2. Local Configuration Discovery
The adapter searches upward from the repository path to find `.agent-os/config.json`:

```javascript
// Start from repository path
let currentDir = config.repositoryPath || process.cwd();

// Search upward until finding .agent-os/config.json
while (currentDir !== rootDir) {
    const configPath = path.join(currentDir, '.agent-os', 'config.json');
    // Try to load config...
    currentDir = path.dirname(currentDir);
}
```

### 3. Repository Overrides
```javascript
// Applied from repository configuration
if (config.agentOSConfig) {
    configurations.push(config.agentOSConfig);
}
```

## Instruction File Loading

Instruction files (prompts) are also loaded with a similar hierarchy:

### Search Order for Instruction Files

1. **Local Project Directory** (`.agent-os/[instructionPath]`)
   - Project-specific instruction files
   - Allows customization per project

2. **Global Directory** (`~/.agent-os/[instructionPath]`)
   - Shared instruction files
   - Fallback when local version not found

3. **Absolute Path** (if provided)
   - Direct path to instruction file
   - Used when full path is specified

### Example
For an instruction file `instructions/analyzer.md`:

```
1. First check: /project/root/.agent-os/instructions/analyzer.md
2. Then check: ~/.agent-os/instructions/analyzer.md
3. Finally check: instructions/analyzer.md (if absolute)
4. If not found: Generate default content
```

## Configuration Structure

### Example Global Configuration (`~/.agent-os/config.json`)
```json
{
  "version": "1.0",
  "settings": {
    "debug": false,
    "maxExecutionTime": 3600
  },
  "subagents": [
    {
      "id": "analyzer",
      "name": "Code Analyzer",
      "instructionFile": "instructions/analyzer.md",
      "capabilities": [
        {"type": "read"},
        {"type": "analyze"}
      ]
    }
  ],
  "workflows": [
    {
      "id": "debug",
      "name": "Debug Workflow",
      "stages": [
        {
          "id": "analyze",
          "subagentId": "analyzer"
        }
      ]
    }
  ],
  "defaultWorkflow": "debug"
}
```

### Example Local Configuration (`.agent-os/config.json`)
```json
{
  "version": "1.0",
  "subagents": [
    {
      "id": "custom-tester",
      "name": "Custom Test Runner",
      "instructionFile": "custom/tester.md",
      "capabilities": [
        {"type": "test"},
        {"type": "report"}
      ]
    }
  ],
  "workflows": [
    {
      "id": "custom-test",
      "name": "Custom Test Workflow",
      "stages": [
        {
          "id": "test",
          "subagentId": "custom-tester"
        }
      ]
    }
  ]
}
```

### Repository Override Example
```javascript
const repository = {
  id: "my-repo",
  name: "My Repository",
  promptSystem: "agent-os",
  agentOSConfig: {
    defaultWorkflow: "custom-test",
    settings: {
      maxExecutionTime: 1800
    }
  }
};
```

## Configuration Merging

Configurations are merged with later sources overriding earlier ones:

1. **Basic Properties**: Direct override (version, mainInstructionFile, defaultWorkflow)
2. **Settings**: Shallow merge of properties
3. **Subagents**: Merged by ID (later definitions replace earlier ones)
4. **Workflows**: Merged by ID (later definitions replace earlier ones)
5. **Label Mappings**: Concatenated (all mappings preserved)

### Merge Example
```javascript
// Global config
{
  "defaultWorkflow": "debug",
  "settings": { "debug": false, "maxRetries": 2 }
}

// Local config
{
  "defaultWorkflow": "test",
  "settings": { "debug": true }
}

// Result after merge
{
  "defaultWorkflow": "test",  // Local overrides global
  "settings": { "debug": true, "maxRetries": 2 }  // Merged
}
```

## Best Practices

### Global Configuration
- Define common subagents and workflows used across projects
- Set personal preferences and defaults
- Keep instruction files general and reusable

### Local Configuration
- Define project-specific workflows and subagents
- Override global settings as needed
- Include project-specific instruction files

### Repository Configuration
- Minimal overrides for repository-specific needs
- Focus on workflow selection and settings
- Avoid duplicating global/local configurations

## File Organization

### Recommended Structure
```
~/.agent-os/                    # Global Agent OS directory
├── config.json                 # Global configuration
├── instructions/              # Global instruction files
│   ├── main.md
│   ├── analyzer.md
│   ├── fixer.md
│   └── tester.md
└── templates/                 # Reusable templates

/project/root/
├── .agent-os/                 # Local Agent OS directory
│   ├── config.json           # Local configuration
│   └── instructions/         # Project-specific instructions
│       ├── custom-analyzer.md
│       └── domain-expert.md
├── src/
└── package.json
```

## Validation

All configurations are validated when loaded:
- Invalid configurations are logged as warnings
- Loading continues with next configuration source
- Default values used when no valid configuration found

## Caching

- Configuration files are loaded once during initialization
- Instruction files are cached after first load
- Cache persists for the lifetime of the adapter instance

## Troubleshooting

### Configuration Not Loading
1. Check file paths and permissions
2. Verify JSON syntax is valid
3. Check console warnings for validation errors

### Instruction Files Not Found
1. Verify file exists in expected location
2. Check search paths match your setup
3. Default content will be used as fallback

### Unexpected Behavior
1. Review configuration merge order
2. Check for overrides at different levels
3. Use debug mode to trace configuration loading
