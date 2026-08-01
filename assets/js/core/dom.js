/**
 * dom.js — le strict minimum pour fabriquer du DOM sans framework.
 *
 *   el("div.card", { onclick: f }, "texte", el("span", "!"))
 *
 * Le selecteur accepte "tag.classe1.classe2". Les proprietes commencant par
 * "on" deviennent des ecouteurs, celles commencant par "--" des variables CSS,
 * le reste est pose en attribut (ou en propriete pour value / checked).
 */

const PROPS = new Set(["value", "checked", "selected", "disabled", "hidden", "textContent"]);

export function el(selector, ...rest) {
  const [tag, ...classes] = String(selector).split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");

  let children = rest;
  const first = rest[0];
  if (first && typeof first === "object" && !Array.isArray(first) && !(first instanceof Node)) {
    applyProps(node, first);
    children = rest.slice(1);
  }
  append(node, children);
  return node;
}

function applyProps(node, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key.startsWith("--")) {
      node.style.setProperty(key, value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (PROPS.has(key)) {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : value);
    }
  }
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === "") continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Vide un noeud et y place le contenu donne. */
export function fill(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

export const $ = (selector, scope = document) => scope.querySelector(selector);

/** Remplit un <select> et restaure la valeur courante si elle existe encore. */
export function setOptions(select, options, current) {
  select.replaceChildren(
    ...options.map((o) => el("option", { value: o.value }, o.label))
  );
  if (current !== undefined) select.value = current;
}
