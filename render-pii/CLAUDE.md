
Personally Identifiable Data (PII) data should never be shown on a User Interface.  However, this is exact what we want to try to accomplish.

Use the main thread and context of the agent to only hold enough information to orchestrate and manage other sub-agents.  All the real work must be delegated to sub-agents, so that the detail does not clutter the main agent context, only summarize enough for the main window context to become aware of interfaces and other high-level summary to be able to effectively function.  Again, delegate all tasks to sub-agents.
