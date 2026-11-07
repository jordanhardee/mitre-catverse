#!/usr/bin/env python3
"""Build local, searchable MITRE data snapshots; fail closed on upstream format changes."""
import datetime as dt
import json
import pathlib
import re
import urllib.request
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)
ATTACK_BASE = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master"
ATLAS_URL = "https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/v6/ATLAS-2026.10.yaml"

def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "mitre-catverse-sync/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()

def clean(text):
    return re.sub(r"<[^>]*>", "", str(text or "")).strip()

def save(name, payload):
    (OUT / (name + ".json")).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def stix_domain(domain):
    url = f"{ATTACK_BASE}/{domain}-attack/{domain}-attack.json"
    data = json.loads(download(url))
    raw = data.get("objects", [])
    if len(raw) < 100:
        raise ValueError(f"{domain}: unexpected empty STIX collection")
    lookup = {}
    for obj in raw:
        if obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue
        refs = obj.get("external_references", [])
        ext = next((r.get("external_id") for r in refs if r.get("source_name") in ("mitre-attack", "mitre-mobile-attack", "mitre-ics-attack") and r.get("external_id")), None)
        if not ext:
            ext = next((r.get("external_id") for r in refs if r.get("external_id")), None)
        if obj.get("type") in ("attack-pattern", "x-mitre-tactic", "intrusion-set", "malware", "tool", "course-of-action", "campaign", "x-mitre-data-source", "x-mitre-data-component"):
            lookup[obj["id"]] = {
                "id": ext or obj["id"], "name": obj.get("name", ""), "type": obj["type"],
                "description": clean(obj.get("description")), "tactics": [p.get("phase_name") for p in obj.get("kill_chain_phases", []) if p.get("phase_name")],
                "url": next((r["url"] for r in refs if r.get("url") and r.get("external_id") == ext), ""),
                "parent": "", "relations": [], "platforms": obj.get("x_mitre_platforms", []),
            }
    for obj in raw:
        if obj.get("type") != "relationship" or obj.get("revoked"):
            continue
        source, target = lookup.get(obj.get("source_ref")), lookup.get(obj.get("target_ref"))
        if source and target:
            rel = obj.get("relationship_type", "related-to")
            if rel == "subtechnique-of":
                source["parent"] = target["id"]
            if len(source["relations"]) < 150:
                source["relations"].append({"type": rel, "id": target["id"], "name": target["name"]})
    entries = list(lookup.values())
    save("attack-" + domain, {"source": url, "domain": domain, "version": data.get("id", ""), "objects": entries})
    return len(entries), url

def atlas():
    raw = yaml.safe_load(download(ATLAS_URL))
    if not isinstance(raw, dict) or "techniques" not in raw or "tactics" not in raw:
        raise ValueError(f"ATLAS schema not recognized; root type={type(raw).__name__}, keys={list(raw)[:25] if isinstance(raw, dict) else repr(raw)[:300]}")
    entries = {}
    sections = ("tactics", "techniques", "mitigations", "case-studies", "software", "entities", "assets")
    for section in sections:
        group = raw.get(section) or {}
        values = group.values() if isinstance(group, dict) else group
        for item in values:
            if not isinstance(item, dict):
                continue
            ident = str(item.get("id") or "")
            if not ident:
                continue
            entries[ident] = {
                "id": ident, "name": item.get("name") or ident,
                "type": item.get("object-type") or section.rstrip("s"),
                "description": clean(item.get("description")),
                "tactics": [], "url": f"https://atlas.mitre.org/{section}/{ident}",
                "parent": "", "relations": [], "platforms": item.get("platforms") or [],
                "maturity": item.get("maturity") or ""
            }
    # ATLAS v6 nests relationships by source ID and relationship type.
    # Flatten those groups without treating wrapper dictionaries as edges.
    def iter_edges(node):
        if isinstance(node, list):
            for child in node:
                yield from iter_edges(child)
        elif isinstance(node, dict):
            if "source" in node and "target" in node:
                yield node
            else:
                for child in node.values():
                    yield from iter_edges(child)

    edges = 0
    for rel in iter_edges(raw.get("relationships") or {}):
        src, dst = rel.get("source"), rel.get("target")
        kind = rel.get("relationship-type") or "related-to"
        if src in entries and dst in entries:
            entries[src]["relations"].append({"type": str(kind), "id": dst, "name": entries[dst]["name"]})
            if kind == "achieves" and entries[dst]["type"] == "tactic":
                entries[src]["tactics"].append(dst)
            if kind == "specializes":
                entries[src]["parent"] = dst
            edges += 1
    if edges < 100:
        raise ValueError(f"ATLAS relationships unexpectedly low: {edges}")
    if len(entries) < 100:
        raise ValueError(f"ATLAS object count too low: {len(entries)}")
    save("atlas", {"source": ATLAS_URL, "version": raw.get("collection", {}).get("version", ""), "objects": list(entries.values())})
    return len(entries), ATLAS_URL

def main():
    sources = {}
    for domain in ("enterprise", "mobile", "ics"):
        count, url = stix_domain(domain)
        sources["attack-" + domain] = {"count": count, "url": url}
        print(domain, count)
    count, url = atlas()
    sources["atlas"] = {"count": count, "url": url}
    print("atlas", count)
    save("manifest", {"generated": dt.datetime.now(dt.timezone.utc).isoformat(), "sources": sources})

if __name__ == "__main__":
    main()
