Context: the user pasted a paragraph a colleague wrote for an internal design doc and asked: "humanize this".

We moved the queue workers to a separate host in March because the web nodes kept running out of memory during the nightly import. Since then the import has finished before 06:00 every night except two, and both of those failures were a timeout on the supplier's side, not ours. I'd keep the split. The extra host costs about as much as one engineer-hour a month.
