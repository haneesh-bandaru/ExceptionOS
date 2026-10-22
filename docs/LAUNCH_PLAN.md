# ExceptionOS launch plan: reaching 200 Qualified MAU in November 2026

Written October 22, 2026. This is a plan, not a result. Nothing below has been posted, uploaded, or submitted.

## What "winning" means in this program

The Anna AI App Builder Program on DoraHacks ([listing](https://dorahacks.io/hackathon/2349/detail)) has **no judging and no top-three ranking**. An app earns a monthly grant when it is approved and published on the Anna Marketplace and reaches **200 Qualified App MAU in one calendar month**. The initial cohort must qualify by **November 30, 2026**. The DoraHacks submission deadline is **October 31, 2026, 15:59 UTC**.

One Qualified App MAU is a unique, signed-in Anna user who completes the app's primary function with a meaningful result. Installs, views, failed runs, test accounts, bots, and coordinated self-runs do not count. Anna's server-side records decide.

For ExceptionOS, the primary function is one successful Anna run: **Read it and draft my reply**, **Draft my follow-up**, a reply analysis, a response draft, or a plan. The 1.1.0 home screen makes the first of these possible in one step.

## Critical path

| Date (2026) | Gate | Owner |
| --- | --- | --- |
| Oct 22–24 | Owner reviews 1.1.0 locally (`npm run anna:dev`); runs `node scripts/test-anna-live-quickstart.js` against the live harness; records a 60–90 second demo | Owner |
| Oct 24–25 | Owner authorizes upload; fresh-install Cloud Agent test of the uploaded build; resubmit for review | Owner |
| By Oct 31 15:59 UTC | Submit the BUIDL on DoraHacks (draft text below) with the demo video and Marketplace link (or "in review") | Owner |
| Oct 25 – approval | Prepare posts, recruit pilot users, answer reviewer feedback the same day | Owner |
| Nov 1–30 | Daily distribution; ~7 new successful users per day averages 200 for the month | Owner |

Review time is the largest unknown. Each day of review in November removes about 3% of the month. Resubmitting early matters more than further polish.

## Funnel arithmetic (planning numbers, not forecasts)

200 qualified users / 30 days ≈ 7 per day. If 40% of people who open the listing complete a run, that is about 17 listing visits per day, or about 500 for the month. If 5% of people who see a post open the listing, that requires about 10,000 impressions. Measure your own conversion during the first week and adjust.

## Channels, in order

1. **Anna's own community (highest conversion: users already have Anna accounts).**
   - Anna Builder Discord (https://discord.gg/7ftTdsdMMz): a showcase post with the demo GIF, and a reply in any "what should I build/try" thread.
   - Anna forum (https://forum.anna.partners): a showcase thread with screenshots and the privacy summary.
   - Ask other builders for honest feedback. Do not trade "I'll run yours if you run mine"; coordinated self-runs are excluded.
2. **Chinese-speaking job seekers and students.** Anna's reviewer used Chinese and the UI now supports it. Use Xiaohongshu (小红书), WeChat groups for 秋招/留学申请, and Zhihu answers to "怎么回复HR邮件" questions.
3. **English-speaking job seekers and applicants.** Reddit (r/jobs, r/careerguidance, r/GradSchool, r/gradadmissions, r/recruitinghell; read each subreddit's self-promotion rules first), LinkedIn posts, and university career-centre newsletters.
4. **Renters and people dealing with official offices.** r/Tenant, r/immigration (helpful answers only where a reply draft genuinely helps).

Every post needs the same three lines: what it does, that it runs inside Anna (sign in at anna.partners, then install ExceptionOS), and that nothing is sent automatically.

## Post templates

**Discord / forum (English)**
> I built ExceptionOS for Anna: paste any email that needs a reply (recruiter, school, landlord, client). In one step Anna shows what they're asking for, with quotes from the original, and drafts a reply with [placeholders] for anything it doesn't know. If you haven't heard back, it drafts a polite follow-up instead. Nothing is sent for you; everything stays in your Anna storage. English and 中文. Feedback very welcome, especially where the draft is wrong. [Marketplace link]

**小红书 / 微信群 (中文)**
> 收到 HR / 学校 / 房东的邮件不知道怎么回？我在 Anna 上做了一个小工具 ExceptionOS：粘贴邮件，一步就能看到对方到底要什么、截止时间是什么（每一点都标注原文出处），并生成可编辑的回复草稿，不确定的信息会用 [占位符] 标出来。投了简历一直没回音？也可以生成礼貌的跟进邮件。不会自动发送任何内容，数据保存在你自己的 Anna 账户。支持中文界面。[链接]

**Reddit (English, helpful-first)**
> When I got "please send examples by Friday" emails I kept missing one of the asks. I made a small free tool that lists every request in the email (quoted), flags the deadline as written, and drafts a reply with placeholders instead of making things up. It runs inside Anna (needs an Anna sign-in). Happy to hear where it gets things wrong. [link]

## DoraHacks BUIDL draft

- **Name:** ExceptionOS
- **One-liner:** Paste any message that needs a reply. See what they want, and get an editable draft in one step.
- **Problem:** People stall on emails from recruiters, schools, landlords, and offices because asks are buried, deadlines are vague, and writing the reply is the hard part. When nobody replies, they don't know how to follow up without sounding pushy.
- **Solution:** A native Anna App. One consented Anna run turns a pasted message into a grounded reading (each point quoted from the source, deadlines kept as written) and an editable reply with placeholders instead of invented facts. A no-reply route drafts polite follow-ups. Users record what they sent and choose check-ins; later drafts include the earlier conversation. An optional planner handles bigger situations. English and Simplified Chinese.
- **Why Anna:** Anna provides inference, signed-in private storage, and the window lifecycle. There is no separate login, backend, database, or API key.
- **Links:** Marketplace listing, GitHub repository, demo video.

## Weekly tracking

Record once a week in a private note (no message content): approved/published state; posts made and where; listing visits if Anna exposes them; successful runs you can observe; feedback themes; fixes shipped. Anna's dashboard or support is the only source for Qualified MAU; local counters do not establish eligibility.

## Rules to keep

- Never ask people to run the app just to count; ask them to try it on a real message.
- Never post the same text repeatedly in one community; follow each community's rules.
- Keep the sample message clearly fictional, and never present test runs as user traction.
