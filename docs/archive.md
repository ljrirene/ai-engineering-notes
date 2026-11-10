---
layout: default
title: Research Archive
permalink: /archive.html
---
# 全部研究

> 按日期查看研究文章、概要、关联文章及交互架构图。

[知识星图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }}) · [选题记录]({{ '/selection-history/' | relative_url }}) · [Learning Guide]({{ '/learning-guide/' | relative_url }})

<div class="research-archive">
{% for s in site.data.studies %}
<article class="research-card">
<div class="research-meta">{{ s.date }} · {{ s.topic }}</div>
<h3><a href="{{ s.url | relative_url }}">{{ s.title }}</a></h3>
<p class="research-sentence"><strong>它解决</strong>{{ s.purpose }}</p>
<p class="research-sentence"><strong>你会学到</strong>{{ s.takeaway }}</p>
{% assign relation = s.related | first %}
{% assign other = site.data.studies | where: "id", relation.id | first %}
{% if other %}
<div class="research-related"><div class="research-related-label">有关联的文章</div><a href="{{ other.url | relative_url }}">{{ other.title }} ↗</a><p>{{ relation.why }}</p></div>
{% endif %}
<div class="research-card-actions"><a href="{{ s.url | relative_url }}">阅读全文 →</a><a href="{{ s.visual | relative_url }}">互动架构图 →</a></div>
</article>
{% endfor %}
</div>

**选题优先级**：职业价值 > 实质技术突破 > 新鲜度 > 可核实社区评价 > 是否当天发布。历史文章部分为按旧选题重新整理，详见[筛选记录]({{ '/selection-history/' | relative_url }})。


