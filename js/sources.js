import * as C from "./common.js";
const { h, t } = C;

C.header();
C.footer();
document.title = t("sources.pageTitle");

const s = await C.sources();
const list = document.getElementById("list");
for (const [id, v] of Object.entries(s)) {
  list.append(h("div", { class: "card src-item" },
    h("h3", {}, v.title),
    h("div", { class: "muted" }, v.publisher, " · ", h("a", { href: v.url, target: "_blank", rel: "noopener" }, v.url)),
    v.note ? h("p", { style: "margin:8px 0 0" }, v.note) : null,
    h("div", { class: "tiny", style: "margin-top:6px" }, h("code", {}, id),
      v.via ? t("sources.via", { via: v.via }) : "", t("sources.retrieved", { date: v.fetched }))));
}
