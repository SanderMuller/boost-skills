Context: a paragraph a colleague wrote in an issue comment. The user asked: "humanize this before I post it under my name".

I probably wouldn't merge this yet. The retry loop is the only place that swallows the timeout — everything else rethrows it — and in order to see the failure you have to run the import twice. I tried it on staging this morning and got the same stack trace both times.
