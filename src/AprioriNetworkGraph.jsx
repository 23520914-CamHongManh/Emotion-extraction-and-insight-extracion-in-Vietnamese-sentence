import { useEffect, useRef, useState } from "react";
import * as d3 from 'd3';

// 🕸️ COMPONENT: ĐỒ THỊ MẠNG NHỆN VẬT LÝ (TƯƠNG TÁC CAO CẤP)
export default function AprioriNetworkGraph({ rules, getAspectName, selectedNodeId, selectedEdge, onNodeClick, onEdgeClick, onBackgroundClick }) {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 650 });

    const prevRulesSignRef = useRef("");
    const simulationRef = useRef(null); // 🚀 BẢO VỆ MẠNG SỐNG CHO D3 KHỎI REACT RENDER

    const NODE_RADIUS = 48;

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setDimensions({
                    width: entries[0].contentRect.width,
                    height: 650
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // 🚀 Dọn dẹp D3 CHỈ KHI người dùng thoát hẳn khỏi Tab (Unmount)
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

        const currentRulesSignature = rules.map(r => `${r.confidence}-${r.support}-${r.lift}`).join("|") + `_width:${dimensions.width}`;
        const isSvgEmpty = d3.select(containerRef.current).select("svg").empty();

        // 🚀 CHỈ VẼ LẠI NẾU LUẬT THAY ĐỔI HOẶC SVG BỊ TRỐNG
        if (currentRulesSignature !== prevRulesSignRef.current || isSvgEmpty) {

            // Tắt lực đẩy của đồ thị cũ trước khi vẽ cái mới
            if (simulationRef.current) {
                simulationRef.current.stop();
            }

            d3.select(containerRef.current).selectAll("*").remove();
            prevRulesSignRef.current = currentRulesSignature;

            // 1. XỬ LÝ DỮ LIỆU NODE & LIÊN KẾT GỘP
            const nodesMap = new Map();
            const linksMap = new Map();

            rules.forEach(rule => {
                const getNodeId = (item) => {
                    const key = typeof item === 'string' ? item : item.key;
                    const sent = typeof item === 'object' && item.sentiment ? item.sentiment : '';
                    return sent ? `${key}_${sent}` : key;
                };

                const antNodes = rule.antecedents.map(getNodeId);
                const conNodes = rule.consequents.map(getNodeId);

                [...rule.antecedents, ...rule.consequents].forEach(item => {
                    const id = getNodeId(item);
                    if (!nodesMap.has(id)) {
                        const isPos = item.sentiment === 'POS';
                        const isNeg = item.sentiment === 'NEG';
                        nodesMap.set(id, {
                            id: id,
                            label: getAspectName(item),
                            sentiment: item.sentiment,
                            color: isPos ? '#10b981' : (isNeg ? '#f43f5e' : '#64748b'),
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
                .range([2.5, 12]);

            const linkColorScale = d3.scaleLinear()
                .domain([1, maxLinkCount])
                .range(["#e2e8f0", "#475569"]);

            // 2. KHỞI TẠO KHÔNG GIAN VẼ D3
            const svg = d3.select(containerRef.current)
                .append("svg")
                .attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`)
                .attr("width", "100%")
                .attr("height", "100%")
                .style("background-color", "#ffffff")
                .style("border-radius", "0.75rem")
                .style("cursor", "grab")
                .on("click", (event) => {
                    if (event.target === svg.node() && onBackgroundClick) {
                        onBackgroundClick();
                    }
                });

            svg.append("defs").selectAll("marker")
                .data(["arrow"])
                .enter().append("marker")
                .attr("id", String)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 0)
                .attr("refY", 0)
                .attr("markerWidth", 5)
                .attr("markerHeight", 5)
                .attr("orient", "auto")
                .append("path")
                .attr("fill", "#94a3b8")
                .attr("d", "M0,-5L10,0L0,5");

            const g = svg.append("g");

            // 🚀 BƯỚC KHỞI ĐỘNG: Trải đều tọa độ ngẫu nhiên gần khu vực tâm
            nodes.forEach(d => {
                d.x = dimensions.width / 2 + (Math.random() - 0.5) * 50;
                d.y = dimensions.height / 2 + (Math.random() - 0.5) * 50;
            });

            // 3. CÀI ĐẶT LỰC ĐẨY VẬT LÝ
            const simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(links).id(d => d.id).distance(320))
                .force("charge", d3.forceManyBody().strength(-2000))
                .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
                .force("collide", d3.forceCollide().radius(NODE_RADIUS + 30).iterations(2))
                .force("x", d3.forceX(dimensions.width / 2).strength(0.015))
                .force("y", d3.forceY(dimensions.height / 2).strength(0.015));

            simulationRef.current = simulation; // 🚀 Gán vào Ref để React không phá được

            // Vẽ đường cạnh liên kết
            const link = g.append("g")
                .selectAll("line")
                .data(links)
                .enter().append("line")
                .attr("class", "graph-link")
                .attr("stroke", d => linkColorScale(d.count))
                .attr("stroke-width", d => linkWidthScale(d.count))
                .attr("opacity", 0.85)
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    event.stopPropagation();
                    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                    if (onEdgeClick) onEdgeClick(sourceId, targetId);
                });

            // Vẽ Nhóm Node 
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

            // Vẽ khối hình tròn
            node.append("circle")
                .attr("r", NODE_RADIUS)
                .attr("fill", d => d.color)
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 3)
                .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.08))");

            // Chữ tên khía cạnh
            node.append("text")
                .text(d => d.label)
                .attr("text-anchor", "middle")
                .attr("y", -2)
                .style("fill", "#ffffff")
                .style("font-size", "11px")
                .style("font-weight", "bold")
                .style("pointer-events", "none");

            // Chữ Đánh giá
            node.append("text")
                .text(d => d.sentiment === 'POS' ? '▲ TỐT' : (d.sentiment === 'NEG' ? '▼ TỆ' : ''))
                .attr("text-anchor", "middle")
                .attr("y", 14)
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

            // 🚀 Bơm 100% nội công ép hệ thống bung xòe!
            simulation.alpha(1).restart();

            // ❌ KHÔNG TRẢ VỀ HÀM CLEAR Ở ĐÂY NỮA ĐỂ TRÁNH BỊ REACT TẮT NHẦM
        }
    }, [rules, dimensions, getAspectName, onNodeClick, onEdgeClick, onBackgroundClick]);

    // 🚀 BỘ LỌC TẦNG 2: CHUYÊN XỬ LÝ HIGHLIGHT TÔ ĐẬM / LÀM MỜ (ĐỒ THỊ GIỮ NGUYÊN)
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
        <div className="w-full border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mt-4 mb-6">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🕸️</span>
                    <h3 className="font-bold text-slate-700 text-sm">Bản đồ liên kết các khía cạnh (Đã tối ưu khoảng cách)</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">Cuộn chuột để Zoom • Nắm giữ kéo để giãn node • Click để lọc luật</span>
            </div>
            <div ref={containerRef} className="w-full" style={{ height: "650px" }} />
        </div>
    );
}