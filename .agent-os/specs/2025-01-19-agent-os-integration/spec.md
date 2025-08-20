# Spec Requirements Document

> Spec: Agent OS Integration for Edge Worker
> Created: 2025-01-19

## Overview

Implement Agent OS as an alternative prompt system alongside the existing edge-worker prompts infrastructure. This feature will provide users with the flexibility to choose between traditional template-based prompts and Agent OS's structured workflow approach without breaking existing functionality.

## User Stories

### Repository Administrator Adopts Agent OS

As a repository administrator, I want to enable Agent OS for my repository so that I can leverage structured workflows and improved agent coordination.

The administrator will update their repository configuration to set the prompt system to "agent-os" and provide the necessary Agent OS configuration paths. The system will automatically use Agent OS instructions instead of traditional prompts while maintaining all existing Linear webhook integrations. This enables advanced workflow orchestration, sub-agent coordination, and structured task execution patterns without disrupting current operations.

### Developer Maintains Multiple Prompt Systems

As a developer managing multiple repositories, I want some repositories to use traditional prompts and others to use Agent OS, so that I can gradually migrate without disrupting existing workflows.

The developer can configure each repository independently, allowing Repository A to continue using traditional prompts while Repository B adopts Agent OS. Both systems function correctly with their respective configurations, enabling a phased migration approach. Developers can switch between systems via simple configuration changes and test Agent OS on non-critical repositories first.

### Operations Team Monitors Performance

As an operations team member, I want to monitor and compare performance between traditional prompts and Agent OS, so that I can make informed decisions about which system to use.

The operations team will have access to metrics showing which prompt system is used for each session, performance comparisons between systems, and error rates for both approaches. This data enables evidence-based decisions about system adoption and helps identify any performance impacts or benefits of each approach.

## Spec Scope

1. **Adapter Pattern Implementation** - Create a clean adapter interface that allows switching between traditional prompts and Agent OS without code changes
2. **Configuration System** - Add promptSystem field and agentOsConfig to RepositoryConfig for easy system selection
3. **Traditional Prompt Adapter** - Wrap existing prompt methods to work with the new adapter interface
4. **Agent OS Adapter** - Implement full Agent OS integration with instruction loading and workflow execution
5. **Runtime Selection Logic** - Modify EdgeWorker to dynamically select and use the appropriate adapter

## Out of Scope

- Migration of existing prompt content to Agent OS format
- Automatic conversion between prompt systems
- Support for running both systems simultaneously on same repository
- Custom Agent OS subagent development
- Modification of existing prompt template behavior

## Expected Deliverable

1. Repository administrators can enable Agent OS via configuration and see it working with their Linear workflows
2. All existing tests pass with the refactored adapter pattern in place
3. Performance metrics show less than 5% overhead when using either prompt system
