# MITRE CATVERSE 🐈‍⬛

An independent, cat-infested **self-hosted knowledge-base viewer** for MITRE ATT&CK and MITRE ATLAS. Created for [jordanhardee.com](https://jordanhardee.com).

**This is not an iframe of MITRE's website.** The static application reads local JSON snapshots generated from MITRE's official data sources. It has no backend, accounts, or analytics.

## What's implemented

- Search ATT&CK Enterprise, Mobile, ICS and ATLAS by ID, title, or description.
- Browse technique cards, object types, tactics, details, relationships, and matrix view.
- A shared neon-cat theme, floating cats, and a chaos toggle with reduced-motion support.
- A Python dataset build pipeline and weekly GitHub Actions update workflow.
- Separate deep links for embedding each dataset in the site's Windows XP-style windows.

## Run locally

Install Python 3.11+:

```sh
python -m pip install -r requirements.txt
python scripts/sync.py
python -m http.server 8000
```

Visit http://localhost:8000/. The generated `data/*.json` files are the actual self-hosted data. Without them the viewer displays a missing-snapshot error; it **does not** fall back to an external website.

## Publishing

Enable **Settings → Pages → Deploy from a branch → main / root** in this repository. GitHub Actions' `Refresh MITRE knowledge bases` workflow downloads official data, transforms it into local searchable JSON, and commits the snapshots. The viewer should then be served at:

https://jordanhardee.github.io/mitre-catverse/

The XP desktop embeds `?dataset=attack-enterprise` and `?dataset=atlas`.

## Data provenance

- [MITRE ATT&CK STIX 2.1 data](https://github.com/mitre-attack/attack-stix-data) (Enterprise, Mobile, ICS)
- [MITRE ATLAS authoritative YAML](https://github.com/mitre-atlas/atlas-data) (current release)
- [ATT&CK terms of use](https://attack.mitre.org/resources/terms-of-use/)

MITRE ATT&CK® and MITRE ATLAS™ are MITRE marks. This independent themed viewer is **not endorsed by or affiliated with MITRE**. The original data retains its attribution and source URLs. Do not confuse this with a fork of MITRE's original website frontend.

## Next steps

Add richer navigation, advanced filtering, improved ATLAS matrix relationship presentation, theme packs, cat animations, and regression tests. This is a working initial codebase, **not yet verified as a fully deployed and populated production site**.
