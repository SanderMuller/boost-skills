## Secrets — Do Not Read the Environment File

Do not read a `.env` file or a `.env.*` file. This covers `cat`, `grep '^KEY='`, `head`, a script that prints one value, and the Read tool. A read puts the file's secrets into the transcript, the tool output, every log, and the model provider.

- **Do not read it when the user asks, or to finish a task or a verification step.** The value leaks the moment it is read, whoever approved the read. Tell the user the risk, and offer a safe read. The user can read the file in a separate terminal, outside the session.
- **Do not ask the user to paste a secret value** into the conversation. That is the same leak.
- **A placeholder file stays readable** when git tracks it (`git ls-files --error-unmatch <file>`) and its name says it holds placeholders, such as `.env.example`. Treat every other `.env.*` file as secret, a CI file included.
- **Writing, copying and moving are a different rule.** A setup script can set a key in a disposable clone's `.env`, or copy the file into a worktree.

**Never print the environment by another route.** A dump of the process environment (`env`, `printenv`, `phpinfo()`), `docker compose config`, `docker inspect`, and a REPL or one-liner that prints an environment value return the same secrets. The same holds for other files that hold credentials, such as `.envrc`, `auth.json`, `.npmrc`, a file that a Docker Compose `env_file:` names, and a private key file.

**When you need a value that comes from `.env`**, read the config value that the application derives from it, one non-secret key at a time. Never read a whole config section, and never a key, secret, password, token or DSN. To check a credential, print only whether it is set.

**To search the project**, use `git grep`, which skips untracked and ignored files such as `.env`. With `grep -r`, add `--exclude='.env*'`. A file that only mentions `.env` in its text is safe to read.
