package pages

import (
	"strings"
	"testing"
)

func TestCreateHtmlPolicy_Sanitize(t *testing.T) {
	policy := CreateHtmlPolicy()
	if policy == nil {
		t.Fatal("expected non-nil policy")
	}

	tests := []struct {
		name         string
		input        string
		mustContain  []string
		mustNotMatch []string
	}{
		{
			name:        "keeps allowed class on supported element",
			input:       `<pre class="language-go highlight">fmt.Println("ok")</pre>`,
			mustContain: []string{`<pre class="language-go highlight">`},
		},
		{
			name:         "removes class with invalid characters",
			input:        `<pre class="evil\" onclick=\"alert(1)">x</pre>`,
			mustContain:  []string{`<pre>x</pre>`},
			mustNotMatch: []string{`class=`, `onclick=`},
		},
		{
			name:        "keeps data-language on pre when valid",
			input:       `<pre data-language="typescript">const a = 1;</pre>`,
			mustContain: []string{`data-language="typescript"`},
		},
		{
			name:        "keeps data-language on code when valid",
			input:       `<code data-language="javascript">const a = 1;</code>`,
			mustContain: []string{`data-language="javascript"`},
		},
		{
			name:        "keeps lexical code highlight metadata",
			input:       `<pre data-language="typescript" data-highlight-language="typescript" data-theme="github">let a = 1;</pre>`,
			mustContain: []string{`data-language="typescript"`, `data-highlight-language="typescript"`, `data-theme="github"`},
		},
		{
			name:         "removes data-language when invalid",
			input:        `<pre data-language="ts<script>">const a = 1;</pre>`,
			mustNotMatch: []string{`data-language=`},
		},
		{
			name:        "keeps anchor target blank",
			input:       `<a href="/p/home" target="_blank">home</a>`,
			mustContain: []string{`target="_blank"`},
		},
		{
			name:         "removes disallowed anchor target",
			input:        `<a href="/p/home" target="_self">home</a>`,
			mustNotMatch: []string{`target="_self"`},
		},
		{
			name:        "keeps allowed style values",
			input:       `<span style="color:#ff0000;font-size:16px">text</span>`,
			mustContain: []string{`style="color:#ff0000;font-size:16px"`},
		},
		{
			name:        "keeps lexical style values with spaces",
			input:       `<span style="color: rgb(239, 68, 68); font-size: 16px;">text</span>`,
			mustContain: []string{`style="color: rgb(239, 68, 68); font-size: 16px;"`},
		},
		{
			name:         "removes dangerous style expression",
			input:        `<span style="background-image:url(javascript:alert(1))">x</span>`,
			mustNotMatch: []string{`style=`},
		},
		{
			name:        "keeps image src with allowed root path",
			input:       `<img src="/media/uploads/photo.png" alt="photo">`,
			mustContain: []string{`src="/media/uploads/photo.png"`},
		},
		{
			name:         "removes image src for javascript scheme",
			input:        `<img src="javascript:alert(1)" alt="photo">`,
			mustNotMatch: []string{`javascript:alert(1)`, `src="javascript:`},
		},
		{
			name:         "removes script element",
			input:        `<p>ok</p><script>alert(1)</script>`,
			mustContain:  []string{`<p>ok</p>`},
			mustNotMatch: []string{`<script`, `alert(1)`},
		},
		{
			name:         "removes inline event handlers",
			input:        `<p onclick="alert(1)">hello</p>`,
			mustContain:  []string{`<p>hello</p>`},
			mustNotMatch: []string{`onclick=`},
		},
		{
			name:        "keeps figure and figcaption classes",
			input:       `<figure class="diagram"><figcaption class="caption">A</figcaption></figure>`,
			mustContain: []string{`<figure class="diagram"><figcaption class="caption">A</figcaption></figure>`},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output := policy.Sanitize(tt.input)

			for _, expected := range tt.mustContain {
				if !strings.Contains(output, expected) {
					t.Fatalf("expected sanitized output to contain %q, got: %s", expected, output)
				}
			}

			for _, forbidden := range tt.mustNotMatch {
				if strings.Contains(output, forbidden) {
					t.Fatalf("expected sanitized output to not contain %q, got: %s", forbidden, output)
				}
			}
		})
	}
}

func TestCreateHtmlPolicy_AllowsRichTextElements(t *testing.T) {
	policy := CreateHtmlPolicy()
	input := `<blockquote><strong>bold</strong> and <em>italic</em></blockquote><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>`
	output := policy.Sanitize(input)

	expected := []string{
		`<blockquote><strong>bold</strong> and <em>italic</em></blockquote>`,
		`<table>`,
		`<thead>`,
		`<tbody>`,
		`<th>H</th>`,
		`<td>D</td>`,
	}

	for _, e := range expected {
		if !strings.Contains(output, e) {
			t.Fatalf("expected output to contain %q, got: %s", e, output)
		}
	}
}

func TestCreateHtmlPolicy_PreservesLexicalSpanColor(t *testing.T) {
	policy := CreateHtmlPolicy()
	input := `<p><span style="color: rgb(59, 130, 246);">Blue text</span></p>`
	output := policy.Sanitize(input)

	if !strings.Contains(output, `style="color: rgb(59, 130, 246);"`) {
		t.Fatalf("expected span color style to be preserved, got: %s", output)
	}

	if !strings.Contains(output, `Blue text`) {
		t.Fatalf("expected text content to be preserved, got: %s", output)
	}
}
