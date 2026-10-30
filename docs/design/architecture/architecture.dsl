workspace "TrainLog" "Local-only installable training app (ADR-001)." {

    !identifiers hierarchical

    model {
        lifter = person "Lifter" "Trains from structured programming on a phone at the gym."

        trainlog = softwareSystem "TrainLog" "Imports or authors routines, runs Sessions offline, derives progression." {
            app = container "Single-page app" "Screens and user flows." "React, TypeScript, Vite" {
                features = component "features" "Screens, hooks and user flows; reads through live queries." "React"
                db = component "db" "Repositories: the only code that touches the stores; transactions and referential rules." "Dexie"
                domain = component "domain" "Pure rules: routine file parsing and validation, scheduling, session transitions, measurement, progression, history, backup format." "TypeScript"
                pwa = component "pwa" "Manifest, update prompt, storage durability." "vite-plugin-pwa"
            }
            serviceWorker = container "Service worker" "Precaches the app shell, assets and fonts; serves deep links offline." "Workbox"
            store = container "Local store" "Nine stores: routines, schedule, sessions, sets, user exercises, settings (ADR-004)." "IndexedDB" "Database"
        }

        staticHost = softwareSystem "Static host" "Serves the built files with an SPA fallback. Receives no user data." "External"
        fileSystem = softwareSystem "Device files / share sheet" "Where routine files come from and backups / CSV go." "External"

        lifter -> trainlog.app "Uses, installed on the home screen"
        trainlog.app.features -> trainlog.app.db "Reads and writes through"
        trainlog.app.features -> trainlog.app.domain "Calls"
        trainlog.app.db -> trainlog.app.domain "Uses types and rules from"
        trainlog.app.db -> trainlog.store "Reads and writes" "IndexedDB transactions"
        trainlog.app.features -> trainlog.app.pwa "Reads and requests storage durability"
        trainlog.app.pwa -> trainlog.serviceWorker "Registers; prompts on update"
        trainlog.serviceWorker -> staticHost "Fetches the app files on install and update" "HTTPS"
        trainlog.app.features -> fileSystem "Opens routine files and backups; saves backups, CSV, routine files" "File picker, Web Share"

        production = deploymentEnvironment "Production" {
            deploymentNode "Cloudflare" "Workers static assets" {
                deploymentNode "Edge" {
                    softwareSystemInstance staticHost
                }
            }
            deploymentNode "Lifter's phone" "iOS or Android" {
                deploymentNode "Browser" "Installed PWA" {
                    containerInstance trainlog.app
                    containerInstance trainlog.serviceWorker
                    containerInstance trainlog.store
                }
            }
        }
    }

    views {
        systemContext trainlog "Context" {
            include *
            autolayout lr
        }
        container trainlog "Containers" {
            include *
            autolayout lr
        }
        component trainlog.app "Layers" "Dependencies point one way: features -> db -> domain, and features -> pwa. domain imports neither db nor features; pwa imports neither features, db nor domain." {
            include *
            autolayout tb
        }
        deployment trainlog production "Deployment" {
            include *
            autolayout lr
        }
        styles {
            element "Database" {
                shape cylinder
            }
            element "External" {
                background #999999
            }
        }
    }
}
