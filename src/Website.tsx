import AddIcon from "@mui/icons-material/AddRounded";
import DeleteIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditIcon from "@mui/icons-material/EditRounded";
import LocateIcon from "@mui/icons-material/CenterFocusStrongRounded";
import LockIcon from "@mui/icons-material/LockOpenRounded";
import ClickThroughIcon from "@mui/icons-material/DoNotTouchRounded";
import SendIcon from "@mui/icons-material/SendRounded";
import VisibilityIcon from "@mui/icons-material/VisibilityRounded";
import { useState, type ReactNode } from "react";
import instructions from "../website-assets/instructions.md?raw";
import hero from "../website-assets/outliner-plus-hero.png";
import contextMenu from "../website-assets/context-menu.png";
import "./website.css";
import { InheritanceEnabledIcon } from "./icons/other/InheritanceIcons";

const INSTALL_URL = `${import.meta.env.VITE_PUBLIC_ORIGIN}/manifest.json`;

const headingIcons: Record<string, ReactNode> = {
  "Create virtual layer": <AddIcon />,
  "State inheritance and overrides": <InheritanceEnabledIcon />,
  "Disable / Enable clicks": <ClickThroughIcon />,
  "Lock / Unlock": <LockIcon />,
  "Show / Hide": <VisibilityIcon />,
  Send: <SendIcon />,
  Delete: <DeleteIcon />,
  Edit: <EditIcon />,
  Locate: <LocateIcon />,
  "to Front / Forward / Backward / to Back": <SendGlyphs />,
  "to Layer": <img src="/send-to-layer.svg" alt="" />,
};

function SendGlyphs() {
  return <span className="glyph-sequence" aria-hidden="true">
    {["send-to-front.svg", "send-forward.svg", "send-backward.svg", "send-to-back.svg"].map((name) => <img key={name} src={`/${name}`} alt="" />)}
  </span>;
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > start) parts.push(text.slice(start, index));
    if (match[1]) parts.push(<a key={index} href={match[2]}>{match[1]}</a>);
    else if (match[3]) parts.push(<strong key={index}>{match[3]}</strong>);
    else if (match[4]) parts.push(<em key={index}>{match[4]}</em>);
    else parts.push(<code key={index}>{match[5]}</code>);
    start = index + match[0].length;
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}

function renderList(lines: string[], start: number, indent: number): [ReactNode, number] {
  const items: Array<{ text: string; children: ReactNode[] }> = [];
  let index = start;
  while (index < lines.length) {
    const match = /^(\s*)-\s+(.+)$/.exec(lines[index]);
    if (!match || match[1].length < indent) break;
    if (match[1].length > indent) {
      if (!items.length) break;
      const [child, next] = renderList(lines, index, match[1].length);
      items[items.length - 1].children.push(child);
      index = next;
      continue;
    }
    items.push({ text: match[2], children: [] });
    index++;
  }
  return [<ul key={start}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.text)}{item.children}</li>)}</ul>, index];
}

function MarkdownGuide({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2];
      const Heading = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(<Heading key={index} id={title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}>
        {headingIcons[title] && <span className="heading-glyph" aria-hidden="true">{headingIcons[title]}</span>}
        {title}
      </Heading>);
      index++; continue;
    }
    const list = /^(\s*)-\s+/.exec(lines[index]);
    if (list) {
      const [rendered, next] = renderList(lines, index, list[1].length);
      blocks.push(rendered);
      index = next;
      continue;
    }
    const paragraph: string[] = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+/.test(lines[index].trim()) && !/^\s*-\s+/.test(lines[index])) paragraph.push(lines[index++].trim());
    blocks.push(<p key={index}>{renderInline(paragraph.join(" "))}</p>);
  }
  return <>{blocks}</>;
}

export function Website() {
  const [copied, setCopied] = useState(false);
  async function copyInstallLink() {
    await navigator.clipboard.writeText(INSTALL_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className="site-shell">
    <header className="site-header">
      <a className="brand" href="https://www.ex-asperis.com/" aria-label="ex Asperis home">
        <img src="/logo.png" alt="" />
        <span><strong>Stage Manager</strong><small>for Owlbear Rodeo</small></span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#overview">Overview</a>
        <a href="#quick-actions">Instructions</a>
        <a href="https://github.com/exAsperis/OBR-Outliner-plus">GitHub</a>
      </nav>
    </header>

    <main>
      <section className="hero">
        <img className="hero-art" src={hero} alt="Stage Manager organizing artwork into virtual layers in Owlbear Rodeo" />
        <div className="hero-copy">
          <p className="eyebrow">Owlbear Rodeo extension</p>
          <h1>Keep every Scene<br />in perfect order.</h1>
          <p>Browse, search, and organize Scene items with virtual layers and fast controls for stacking, visibility, and locking.</p>
          <div className="hero-actions">
            <button type="button" onClick={() => void copyInstallLink()}><span>{copied ? "Copied" : "Copy install link"}</span></button>
            <a href="#overview">Read the guide</a>
          </div>
        </div>
      </section>

      <section className="guide-layout">
        <aside>
          <p>On this page</p>
          <a href="#overview">Overview</a>
          <a href="#build-a-scene-in-layers">Build a scene</a>
          <a href="#create-dramatic-scene-states-or-even-virtual-vertical-levels">Scene states</a>
          <a href="#run-the-game-from-the-outline">Run the game</a>
          <a href="#quick-actions">Quick actions</a>
          <a href="#owlbear-context-menu">Context menu</a>
          <div className="install-note"><strong>Install in Owlbear Rodeo</strong><code>{INSTALL_URL}</code><button type="button" onClick={() => void copyInstallLink()}>{copied ? "Copied" : "Copy link"}</button></div>
        </aside>
        <article className="guide">
          <MarkdownGuide source={instructions} />
          <figure className="context-figure">
            <img src={contextMenu} alt="The Stage Manager Send submenu in Owlbear Rodeo's item context menu" />
            <figcaption>The Send submenu in Owlbear Rodeo’s item context menu.</figcaption>
          </figure>
        </article>
      </section>
    </main>

    <footer><span>Stage Manager for Owlbear Rodeo by ex Asperis</span><a href="https://github.com/exAsperis/OBR-Outliner-plus">Source on GitHub</a></footer>
  </div>;
}
