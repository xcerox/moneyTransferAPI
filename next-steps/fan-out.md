# Moving to fan-out (later)

This is deferred work. Right now the app runs as a single Lambda, and that's the right call.
Don't start this migration just because it's here. Start it when something concrete pushes you
to, and this file exists so that when that day comes you're following a plan instead of doing
research from scratch.

## Read this before you touch anything

The honest default is: don't do it. One Lambda running the whole app is simpler to reason about,
simpler to deploy, and it's what the tests exercise today. Splitting it up buys you things you
probably don't need yet, at a cost that's easy to underestimate. So the first step isn't code,
it's an honest check of whether you actually have a reason.

If you do decide to split, don't jump straight to one Lambda per endpoint. Go to two Lambdas
first: one for accounts (read only) and one for transfers (read and write). You get most of the
benefit for a fraction of the work, and you keep everything NestJS gives you.

## When it's actually worth doing

There are only a few situations where splitting pays off, and in each one there's a clear thing
to do.

If security or compliance requires that a read endpoint physically cannot write to the database,
that's the strongest reason, and it's a real one for a money API. The fix is the two-Lambda split
so the accounts function has read-only permissions and simply can't run a transfer.

If one endpoint has a load or latency profile that's genuinely different from the rest, and you've
measured it, pull just that endpoint out into its own function. Don't split everything because one
route is hot.

If separate teams are going to own accounts and transfers, splitting by resource gives each team
its own deploy and its own blast radius.

If cold starts on the transfer path are measurably a problem, try provisioned concurrency first.
It's cheaper and less risky than a rewrite, and it often solves the problem on its own.

And if none of those are true, leave it alone. That's not a cop-out, it's the correct answer for a
single service owned by one team that isn't under load.

## What you gain

The real prize is per-function permissions. Today one role has every permission the app needs, so
in principle the code that lists accounts could also move money. With separate functions, the
accounts Lambda gets read-only access and the ability to transfer simply isn't there. Smaller
blast radius, easier to reason about, easier to defend in an audit.

You also get independent deploys, so a change to accounts doesn't redeploy the transfer path and a
bug in one function doesn't take the others down with it. You can scale and tune each function on
its own, so a spike on transfers won't starve the health check, and you can set memory, timeout,
and provisioned concurrency per route. Read-only handlers boot lighter because they don't drag in
the transfer logic, and your metrics and logs end up cleanly separated per endpoint.

## What it costs

The part people underestimate is that everything Nest does for you automatically today becomes
your job. Validation, idempotency, error mapping, logging, and the request trace id are all wired
up once, globally, right now. Split the app and each handler has to run that machinery itself, or
you build a shared wrapper that does it. That wrapper is the main source of subtle bugs, because
it's easy for one handler to validate slightly differently or map an error slightly wrong.

Beyond that, the entry layer is a real rewrite. The domain, the services, and the persistence
layer don't change at all, which is the whole point of how the app is structured, but every
endpoint needs its own handler and the HTTP plumbing that used to be free. There's more to deploy:
more functions, more roles, more configuration, and you'll need a plugin to get per-function IAM
roles since the framework doesn't do it natively. You lose the single Swagger page, because there's
no longer one unified app to generate it from. And you're trading tested, centralized behavior for
new code, which is fine when there's a reason and a waste of a good test suite when there isn't.

## The plan, when the time comes

Aim for the two-Lambda shape: one function for accounts, one for transfers. The core of the app
stays exactly as it is. The entities, errors, services, repositories, DTOs, the exception filter,
and the idempotency interceptor are all reused. Only the entry layer and the infrastructure
change.

Start by confirming the reason is real, and measure it if you can. Add the per-function IAM roles
plugin to the Serverless config. Write an accounts handler that boots the accounts module as a
standalone Nest context and serves the two account routes, and a transfers handler that does the
same for the three transfer routes. Build one shared wrapper that every handler runs, so
validation, error-to-envelope mapping, and logging with a trace id live in a single place rather
than being copied around. Move the idempotency logic into the create-transfer path of the
transfers handler.

Then rework the Serverless config. Replace the single catch-all function with an accounts function
and a transfers function, each with its own routes and its own permissions. The accounts function
only needs to read the accounts table. The transfers function needs transactional writes and
read-write access across all three tables. Decide what happens to the docs page: either drop it or
keep a tiny extra function that serves the spec. Point the health check at the lightest function.
Add handler-level tests so the validation and error mapping you moved out of Nest stay covered, on
top of the service tests that still apply. Verify the whole thing locally against DynamoDB Local
before deploying, and update the README once it's done.

## What not to do

Don't go all the way to one Lambda per endpoint. Six functions only makes sense at the scale of a
large organization with separate teams and very different traffic per route, and that isn't this
project. And don't throw out NestJS for a lighter framework to shave cold starts. The cold-start
win is real but modest, and you'd be giving up the dependency injection, testing, and OpenAPI
support the whole app is built around.
