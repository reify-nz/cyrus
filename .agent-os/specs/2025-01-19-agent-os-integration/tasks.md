# Spec Tasks

## Tasks

- [x] 1. Create Adapter Pattern Foundation
  - [x] 1.1 Write tests for PromptSystemAdapter interface
  - [x] 1.2 Create PromptSystemAdapter interface with all required methods
  - [x] 1.3 Create PromptContext interface for passing context to adapters
  - [x] 1.4 Create PromptSystemFactory for adapter creation
  - [x] 1.5 Write tests for PromptSystemFactory
  - [x] 1.6 Implement PromptSystemFactory with lazy loading
  - [x] 1.7 Verify all tests pass

- [ ] 2. Implement Traditional Prompt Adapter
  - [x] 2.1 Write tests for TraditionalPromptAdapter
  - [x] 2.2 Create TraditionalPromptAdapter class implementing interface
  - [x] 2.3 Wrap buildPromptV2 method in adapter
  - [x] 2.4 Wrap buildLabelBasedPrompt method in adapter
  - [x] 2.5 Wrap buildMentionPrompt method in adapter
  - [x] 2.6 Implement getToolRestrictions using existing buildAllowedTools
  - [ ] 2.7 Ensure all existing EdgeWorker tests still pass
  - [ ] 2.8 Verify all tests pass

- [ ] 3. Update EdgeWorker to Use Adapter Pattern
  - [ ] 3.1 Write tests for EdgeWorker adapter integration
  - [ ] 3.2 Add promptSystem configuration to RepositoryConfig interface
  - [ ] 3.3 Modify EdgeWorker constructor to create PromptSystemFactory
  - [ ] 3.4 Update handleAgentSessionCreatedWebhook to use adapter
  - [ ] 3.5 Update handleUserPostedAgentActivity to use adapter
  - [ ] 3.6 Update buildSessionPrompt to use adapter
  - [ ] 3.7 Ensure backward compatibility with existing configs
  - [ ] 3.8 Verify all tests pass

- [ ] 4. Implement Agent OS Adapter
  - [ ] 4.1 Write tests for AgentOSAdapter
  - [ ] 4.2 Create AgentOSAdapter class implementing interface
  - [ ] 4.3 Add agentOsConfig to RepositoryConfig interface
  - [ ] 4.4 Implement Agent OS configuration loading
  - [ ] 4.5 Create Linear label to Agent OS command mapper
  - [ ] 4.6 Implement instruction set loader and cache
  - [ ] 4.7 Transform Linear issues to Agent OS context format
  - [ ] 4.8 Verify all tests pass

- [ ] 5. Integration Testing and Documentation
  - [ ] 5.1 Write integration tests for both adapters
  - [ ] 5.2 Create example configurations for both systems
  - [ ] 5.3 Write migration guide documentation
  - [ ] 5.4 Update EdgeWorker README with new configuration options
  - [ ] 5.5 Add performance benchmarks for both systems
  - [ ] 5.6 Create troubleshooting guide
  - [ ] 5.7 Verify all tests pass
