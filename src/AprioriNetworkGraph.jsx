import { useEffect, useRef, useState } from "react";
import * as d3 from 'd3';

const GRAPH_HEIGHT = 620;

function splitNodeLabel(label) {
    const text = String(label || "").trim();
    if (!text) return [""];
    if (text.includes("/")) return text.split("/").map(part => part.trim()).filter(Boolean).slice(0, 2);

    const words = text.split(/\s+/);
    if (words.length <= 2) return [text];

    const middle = Math.ceil(words.length / 2);
    return [words.slice(0, middle).join(" "), words.slice(middle).join(" ")].filter(Boolean).slice(0, 2);
}

export default function AprioriNetworkGraph({ rules, getAspectName, selectedNodeId, selectedEdge, onNodeClick, onEdgeClick, onBackgroundClick }) {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: GRAPH_HEIGHT });

    const prevRulesSignRef = useRef("");
    const simulationRef = useRef(null);

    const NODE_RADIUS = 46;

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setDimensions({
                    width: entries[0].contentRect.width,
                    height: GRAPH_HEIGHT
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        return () => {
            if (simulationRef.current) simulationRef.current.stop();
        };
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        if (!rules || rules.length === 0) {
            if (simulationRef.current) simulationRef.current.stop();
            d3.select(containerRef.current).selectAll("*").remove();
            prevRulesSignRef.current = "";
            return;
        }

        if (dimensions.width <= 0) return;

        const getRuleItemId = (item) => {
            const key = typeof item === 'string' ? item : item.key;
            const sent = typeof item === 'object' && item.sentiment ? item.sentiment : '';
            return sent ? `${key}_${sent}` : key;
        };

        const currentRulesSignature = rules.map(r => {
            const antecedents = r.antecedents.map(getRuleItemId).join("+");
            const consequents = r.consequents.map(getRuleItemId).join("+");
            return `${antecedents}->${consequents}:${r.confidence}-${r.support}-${r.lift}`;
        }).join("|") + `_width:${dimensions.width}`;
        const isSvgEmpty = d3.select(containerRef.current).select("svg").empty();

        if (currentRulesSignature !== prevRulesSignRef.current || isSvgEmpty) {

            if (simulationRef.current) {
                simulationRef.current.stop();
            }

            d3.select(containerRef.current).selectAll("*").remove();
            prevRulesSignRef.current = currentRulesSignature;

            const nodesMap = new Map();
            const linksMap = new Map();

            rules.forEach(rule => {
                const antNodes = rule.antecedents.map(getRuleItemId);
                const conNodes = rule.consequents.map(getRuleItemId);

                [...rule.antecedents, ...rule.consequents].forEach(item => {
                    const id = getRuleItemId(item);
                    if (!nodesMap.has(id)) {
                        const isPos = item.sentiment === 'POS';
                        const isNeg = item.sentiment === 'NEG';
                        nodesMap.set(id, {
                            id: id,
                            label: getAspectName(item),
                            sentiment: item.sentiment,
                            color: isPos ? '#059669' : (isNeg ? '#e11d48' : '#64748b'),
                        });
                    }
                });

                antNodes.forEach(sourceId => {
                    conNodes.forEach(targetId => {
                        if (sourceId === targetId) return;
                        const linkKey = `${sourceId}->${targetId}`;

                        if (!linksMap.has(linkKey)) {
                            linksMap.set(linkKey, {
                                source: sourceId,
                                target: targetId,
                                count: 1,
                                confidenceSum: rule.confidence
                            });
                        } else {
                            const existingLink = linksMap.get(linkKey);
                            existingLink.count += 1;
                            existingLink.confidenceSum += rule.confidence;
                        }
                    });
                });
            });

            const nodes = Array.from(nodesMap.values());
            const links = Array.from(linksMap.values());

            const maxLinkCount = d3.max(links, d => d.count) || 1;

            const linkWidthScale = d3.scaleLinear()
                .domain([1, maxLinkCount])
                .range([1.75, 7]);

            const linkColorScale = d3.scaleLinear()
                .domain([1, maxLinkCount])
                .range(["#cbd5e1", "#64748b"]);

            const svg = d3.select(containerRef.current)
                .append("svg")
                .attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`)
                .attr("width", "100%")
                .attr("height", "100%")
                .style("background-color", "#f8fafc")
                .style("cursor", "grab")
                .on("click", (event) => {
                    if (event.target === svg.node() && onBackgroundClick) {
                        onBackgroundClick();
                    }
                });

            svg.append("defs")
                .append("marker")
                .attr("id", "apriori-arrow")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 0)
                .attr("refY", 0)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("fill", "#64748b")
                .attr("d", "M0,-5L10,0L0,5");

            const g = svg.append("g");

            nodes.forEach(d => {
                d.x = dimensions.width / 2 + (Math.random() - 0.5) * 50;
                d.y = dimensions.height / 2 + (Math.random() - 0.5) * 50;
            });

            const simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(links).id(d => d.id).distance(280))
                .force("charge", d3.forceManyBody().strength(-1700))
                .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
                .force("collide", d3.forceCollide().radius(NODE_RADIUS + 30).iterations(2))
                .force("x", d3.forceX(dimensions.width / 2).strength(0.015))
                .force("y", d3.forceY(dimensions.height / 2).strength(0.015));

            simulationRef.current = simulation;

            const link = g.append("g")
                .selectAll("line")
                .data(links)
                .enter().append("line")
                .attr("class", "graph-link")
                .attr("stroke", d => linkColorScale(d.count))
                .attr("stroke-width", d => linkWidthScale(d.count))
                .attr("opacity", 0.85)
                .attr("stroke-linecap", "round")
                .attr("marker-end", "url(#apriori-arrow)")
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    event.stopPropagation();
                    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                    if (onEdgeClick) onEdgeClick(sourceId, targetId);
                });

            const node = g.append("g")
                .selectAll("g")
                .data(nodes)
                .enter().append("g")
                .attr("class", "graph-node")
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    if (event.defaultPrevented) return;
                    event.stopPropagation();
                    if (onNodeClick) onNodeClick(d.id);
                })
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended));

            node.append("circle")
                .attr("r", NODE_RADIUS)
                .attr("fill", d => d.color)
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 3)
                .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.08))");

            const label = node.append("text")
                .attr("text-anchor", "middle")
                .style("fill", "#ffffff")
                .style("font-size", "10.5px")
                .style("font-weight", "bold")
                .style("pointer-events", "none");

            label.each(function (d) {
                const lines = splitNodeLabel(d.label);
                const startY = d.sentiment ? -11 : lines.length > 1 ? -7 : 3;

                d3.select(this)
                    .selectAll("tspan")
                    .data(lines)
                    .enter()
                    .append("tspan")
                    .attr("x", 0)
                    .attr("y", (_, index) => startY + index * 12)
                    .text(line => line);
            });

            node.append("text")
                .text(d => d.sentiment === 'POS' ? '▲ TỐT' : (d.sentiment === 'NEG' ? '▼ TỆ' : ''))
                .attr("text-anchor", "middle")
                .attr("y", 19)
                .style("fill", "#ffffff")
                .style("font-size", "10px")
                .style("font-weight", "black")
                .style("opacity", 0.95)
                .style("pointer-events", "none");

            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => {
                        const dx = d.target.x - d.source.x;
                        const dy = d.target.y - d.source.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance === 0) return d.target.x;
                        const ratio = (NODE_RADIUS + 8) / distance;
                        return d.target.x - dx * ratio;
                    })
                    .attr("y2", d => {
                        const dx = d.target.x - d.source.x;
                        const dy = d.target.y - d.source.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance === 0) return d.target.y;
                        const ratio = (NODE_RADIUS + 8) / distance;
                        return d.target.y - dy * ratio;
                    });

                node.attr("transform", d => `translate(${d.x},${d.y})`);
            });

            svg.call(d3.zoom()
                .extent([[0, 0], [dimensions.width, dimensions.height]])
                .scaleExtent([0.4, 3])
                .on("zoom", (event) => {
                    g.attr("transform", event.transform);
                })
            );

            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.2).restart();
                d.fx = d.x;
                d.fy = d.y;
                d3.select(this).select("circle").attr("stroke", "#1e293b").attr("stroke-width", 4);
            }

            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }

            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
                d3.select(this).select("circle").attr("stroke", "#ffffff").attr("stroke-width", 3);
            }

            simulation.alpha(1).restart();
        }
    }, [rules, dimensions, getAspectName, onNodeClick, onEdgeClick, onBackgroundClick]);

    useEffect(() => {
        if (!containerRef.current) return;
        const svg = d3.select(containerRef.current).select("svg");
        if (svg.empty()) return;

        const d3Nodes = svg.selectAll(".graph-node");
        const d3Links = svg.selectAll(".graph-link");

        if (!selectedNodeId && !selectedEdge) {
            d3Nodes.style("opacity", 1);
            d3Nodes.select("circle").attr("stroke", "#ffffff").attr("stroke-width", 3);
            d3Links.style("opacity", 0.85);
            return;
        }

        if (selectedNodeId) {
            d3Nodes.style("opacity", d => d.id === selectedNodeId ? 1 : 0.15);
            d3Nodes.filter(d => d.id === selectedNodeId).select("circle").attr("stroke", "#2563eb").attr("stroke-width", 4.5);
            d3Nodes.filter(d => d.id !== selectedNodeId).select("circle").attr("stroke", "#ffffff").attr("stroke-width", 3);

            d3Links.style("opacity", d => {
                const sId = typeof d.source === 'object' ? d.source.id : d.source;
                const tId = typeof d.target === 'object' ? d.target.id : d.target;
                return (sId === selectedNodeId || tId === selectedNodeId) ? 1 : 0.03;
            });
        }
        else if (selectedEdge) {
            const [edgeSrc, edgeTgt] = selectedEdge;
            d3Nodes.style("opacity", d => (d.id === edgeSrc || d.id === edgeTgt) ? 1 : 0.15);
            d3Nodes.select("circle").attr("stroke", "#ffffff").attr("stroke-width", 3);

            d3Links.style("opacity", d => {
                const sId = typeof d.source === 'object' ? d.source.id : d.source;
                const tId = typeof d.target === 'object' ? d.target.id : d.target;
                const isMatch = (sId === edgeSrc && tId === edgeTgt) || (sId === edgeTgt && tId === edgeSrc);
                return isMatch ? 1 : 0.03;
            });
        }
    }, [selectedNodeId, selectedEdge, rules]);

    return (
        <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đồ thị liên kết</p>
                    <h3 className="text-sm font-bold text-slate-950">Mạng quan hệ giữa các khía cạnh</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2 py-1 text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        Tốt
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2 py-1 text-rose-700">
                        <span className="h-2 w-2 rounded-full bg-rose-600" />
                        Tệ
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">
                        <span className="h-0.5 w-5 rounded-full bg-slate-500" />
                        Liên kết mạnh
                    </span>
                </div>
            </div>
            <div ref={containerRef} className="w-full" style={{ height: `${GRAPH_HEIGHT}px` }} />
        </div>
    );
}
