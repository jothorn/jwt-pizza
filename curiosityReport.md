# JavaScript Runtimes
Everyone knows that good web developers must completely re-learn a new tech stack every few years. Why use stable, trusted, old technologies when there are so many shiny new ones to replace them? Node.js is already almost 17 years old, so it's about time we used something better!

## Deno

Deno was released in 2018 by the same guy who created Node.js (apparently he left Node.js in 2012).

* **Written in**: Rust! Everyone's favorite language because of its fast memory-saftey guaruntees. 
* **JavaScript engine**: Google Chrome's V8, just like Node.
* **Built-in tools**: Deno's single binary executable replaces the need for dozens of dev dependencies including npm, prettier, eslint, jest, and others. Everything is configured in a single deno.json file (though deno can still read package.json files from existing projects). This unified toolchain greatly simplifies DevOps and QA.
* **Fast Install**: Deno uses parallel downloads to significantly reduce dependency install times compared to npm. This makes a big difference for the speed of CI/CD.
* **Security**: This is the real selling point for me. The typical web application has hundreds of third-party dependencies. If a single one of those libraries gets compromised, then the developer will be running malware on their personal computer and their server. Deno sandboxes everything by default. You have to grant narrow, explicit permissions to let anything out of the sandbox.
* **Web Standards**: A lot of effort and coordination is made between the major web browsers to ensure that JavaScript is standardized and runs the same in any browser. Whereas Node just made up its own API, Deno follows the same API standardized by browsers.

## Bun

Bun is the hot new runtime, released in 2021 and just barely acquired by Anthropic. Deno would probably be way more popular right now if it weren't for Bun. Bun prioritizes speed and being a drop-in replacement for Node. It unfortunately does not prioritize security as much as Deno.

* **Written in**: Zig, a language released in 2016 which isn't even stable yet. Zig is like C but improved with everything we've learned in the 54 years since C was released. The Bun developers probably chose Zig because it allows them to develop fast, even though it's not memory-safe or stable like Rust.
* **JavaScript engine**: Safari's JavaScriptCore, which has a faster startup time and better memory efficiency than V8. Faster startup is great not just for development but also for CI/CD pipelines. V8 is probably still a bit faster for long-running tasks though.
* **Built-in tools**: Bun doesn't have as many built-in tools as Deno, but it does still replace npm and jest. And, unlike Deno, it can replace Vite.
* **Even Faster Install**: Bun uses a custom lockfile format which it can parse in parallel, leading to even faster install times compared to Deno.
* **Secuirty**: Unlike Deno, Bun is meant to be a drop-in replacement for Node, so code is _not_ sandboxed. It does, however, block post-install scripts, preventing attacks like [this one that happened two days ago](https://www.stepsecurity.io/blog/axios-compromised-on-npm-malicious-versions-drop-remote-access-trojan) where a compromised top-10 npm package ran malicious code seconds after the developer ran `npm install`.
* **Built-in APIs**: They have a bunch of built-in APIs, such as one for bcrypt.

 ### Learning the hard way

I decided to replace Vite with Bun's built-in bundler for one of my personal projects. It's not like Vite needed replacing, Vite is great. I just wanted to try the cool new thing. Pretty quickly, though, I ran into this error whenever I made a change to the front end:

 ![Runtime Error: Unknown HMR script](https://private-user-images.githubusercontent.com/744792/444887224-0d40a9f0-94db-4a29-9fe2-248e78906f91.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzUwOTMyNTMsIm5iZiI6MTc3NTA5Mjk1MywicGF0aCI6Ii83NDQ3OTIvNDQ0ODg3MjI0LTBkNDBhOWYwLTk0ZGItNGEyOS05ZmUyLTI0OGU3ODkwNmY5MS5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwNDAyJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDQwMlQwMTIyMzNaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT0xMjU1N2M5Yjg0ZWFmYWU4YzA0M2Q5NjdkMjUyMGUzOTlhNDg4ZThhYzE4OGYzNzE1MmM4YTg0ZGEyOTFhN2RjJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.2hA6iOJftp3-mdFho6OEnFwOVmOmZFhvCs8ZJ1z1wl4)

Turns out this was a [known issue](https://github.com/oven-sh/bun/issues/19736) with the bundler. I had to switch back to Vite to continue development. Turns out there _is_ some wisdom to picking old, reliable technologies.

## Why I'm choosing Deno for my next project

I'm scared of getting hacked. I keep hearing stories, like [this guy](https://blog.daviddodda.com/how-i-almost-got-hacked-by-a-job-interview) who almost got hacked by a job interview that asked him to install malware from a malicious package.json. Or all of the python packages that [keep getting compromised](https://www.theregister.com/2026/03/30/telnyx_pypi_supply_chain_attack_litellm/) - unrelated to javascript runtimes, but it's a reminder that we as developers are not safe. Deno would make us a lot safer.
