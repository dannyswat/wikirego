package pages

import (
	"regexp"

	"github.com/microcosm-cc/bluemonday"
)

func CreateHtmlPolicy() *bluemonday.Policy {
	policy := bluemonday.UGCPolicy()
	policy.AllowAttrs("class").Matching(regexp.MustCompile("^([ a-zA-Z0-9_-]+)$")).OnElements("code", "pre", "figure", "figcaption", "div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "table", "tr", "td", "th", "tbody", "thead", "tfoot", "caption", "em", "strong", "b", "i", "u", "s", "sub", "sup", "del", "mark", "small", "big", "center", "font", "strike")
	policy.AllowAttrs("data-language").Matching(regexp.MustCompile("^([A-Za-z0-9_-]+)$")).OnElements("pre", "code")
	policy.AllowAttrs("data-highlight-language").Matching(regexp.MustCompile("^([A-Za-z0-9_-]+)$")).OnElements("pre", "code")
	policy.AllowAttrs("data-theme").Matching(regexp.MustCompile("^([A-Za-z0-9_-]+)$")).OnElements("pre", "code")
	policy.AllowAttrs("target").Matching(regexp.MustCompile("^_blank$")).OnElements("a")
	policy.AllowAttrs("style").Matching(regexp.MustCompile(`^\s*([A-Za-z0-9-]+\s*:\s*([A-Za-z0-9.#%-]+|((rgb|hsl|rgba)\([0-9%, ]+\)))\s*;?\s*)+$`)).OnElements("span", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img", "table", "tr", "td", "th", "tbody", "thead", "tfoot", "caption", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "br", "em", "strong", "b", "i", "u", "s", "sub", "sup", "del", "mark", "small", "big", "center", "font", "strike", "figure")
	policy.AllowAttrs("src").Matching(regexp.MustCompile("^/[A-Za-z0-9_]")).OnElements("img")
	return policy
}
