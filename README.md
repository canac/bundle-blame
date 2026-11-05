# bundle-blame

Track changes in Next.js and Vite bundle sizes across commits.

## Installation

```sh
$ deno install --global --allow-env --allow-read --allow-write --allow-run jsr:@canac/bundle-blame

# Install shell completions (optional)
$ bundle-blame --completion bash > ~/.bashrc.d/bundle-blame.bash && source ~/.bashrc.d/bundle-blame.bash
$ bundle-blame --completion zsh > ~/.zsh/completions/_bundle-blame
$ bundle-blame --completion fish > ~/.config/fish/completions/bundle-blame.fish
```

## Usage

```sh
$ bundle-blame                  # show changes since main
$ bundle-blame HEAD~10          # show changes in the last 10 commits
$ bundle-blame --delta 32       # show changes over 32 bytes
$ bundle-blame -C ~/dev/project # show changes in a specific directory
```
