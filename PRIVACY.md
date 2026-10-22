# ExceptionOS Privacy

ExceptionOS stores goals, plans, up to five previous plan snapshots per goal, progress notes, evidence links, pasted messages and replies, reply analyses, response and follow-up drafts, the description of your last message to an organization, responses and follow-ups you record as sent, follow-up status, chosen check-in dates, and outcomes in the signed-in user's private Anna storage. It does not run a separate account system or backend database. Anna storage is authoritative; the app does not restore workspace data from an unscoped browser cache. Any cache left by an earlier version is removed after a successful storage read. Unsaved form drafts and plan updates awaiting your review are held in memory while the App remains open. Your interface language choice (English or Chinese) is kept in this browser's local storage.

Every Anna model request requires you to tick a consent box first. Saving a message, note, edited draft, or check-in alone does not call the model.

**Read it and draft my reply** (home screen) first saves the pasted message to your workspace, then sends Anna's configured model provider the message, the optional outcome you entered, and the same goal context used for drafting below. One request returns both the analysis and a draft.

**Draft my follow-up** (home screen) and **Draft a follow-up** first save your description of your last message and its optional date, then send the model provider the goal title, outcome, organization, context and prior attempt, that description and date, today's date, the conversation history described below, completed checklist actions, the five latest non-milestone notes and evidence URLs, and optional details you enter.

**Analyze reply with Anna** and **Prepare response** send the selected reply and its sender/received date, your goal title, outcome, organization, context and prior attempt, the conversation history described below, completed checklist actions, the five latest non-milestone notes and evidence URLs, any existing analysis, the latest response recorded as sent for that reply, and optional details you enter for drafting. Draft replacement requires consent again.

**Conversation history** means up to eight of the most recent saved items, oldest first: other saved replies (up to 1,200 characters each), responses and follow-ups you recorded as sent (up to 900 characters each), and your last-message description. It lets Anna avoid asking you to resend something you already sent.

When you consent to **Build my action plan** or **Generate updated plan**, the model provider receives your goal fields, the current checklist and completion state, outstanding questions, the ten most recent non-milestone progress updates (including evidence URLs and dates), your follow-up status, your last-message description, the three latest follow-ups recorded as sent, and the latest four saved replies with their most recently recorded sent responses.

ExceptionOS does not connect to your inbox or send messages. Copy response and Copy follow-up write the visible subject and body to your clipboard when supported; otherwise they select the body for manual copying. Recording a response or follow-up as sent is a user-entered status record. Check-in dates appear within the app; they do not create external calendar events or background notifications. Evidence links are not fetched by ExceptionOS. Model credentials stay with Anna. The built-in sample message is fictional. Remove sensitive identifiers from pasted messages and do not enter passwords, government identifiers, financial account numbers, medical records, or other secrets.

ExceptionOS does not sell data, run advertising, or include analytics or third-party trackers. A user can delete a goal and its history from the application.

Last updated: October 22, 2026.
