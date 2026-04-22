'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import styles from '../MainContent.module.css';

interface Node {
  id: string;
  label: string;
  platform: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Edge {
  source: string;
  target: string;
  opacity: number;
}

// Platforms colors for the "Neural Nodes"
const PLATFORM_COLORS: Record<string, string> = {
  slack: '#4A154B',
  github: '#1F1F1F',
  google: '#4285F4',
  notion: '#000000',
  discord: '#5865F2',
  reddit: '#FF4500',
  linkedin: '#0A66C2',
};

const MOCK_NODES: Partial<Node>[] = [
  { id: '1', label: 'Project Omega Design', platform: 'slack' },
  { id: '2', label: 'Auth Middleware Fix', platform: 'github' },
  { id: '3', label: 'Meeting: Q2 Strategy', platform: 'google' },
  { id: '4', label: 'Database Schema', platform: 'notion' },
  { id: '5', label: 'Community Feedback', platform: 'reddit' },
  { id: '6', label: 'New Hire Onboarding', platform: 'slack' },
  { id: '7', label: 'Marketing Campaign', platform: 'linkedin' },
  { id: '8', label: 'API Documentation', platform: 'github' },
  { id: '9', label: 'User Research Results', platform: 'notion' },
  { id: '10', label: 'Bug: Infinite Loading', platform: 'slack' },
];

const MOCK_EDGES: Edge[] = [
  { source: '1', target: '2', opacity: 0.4 },
  { source: '2', target: '4', opacity: 0.3 },
  { source: '3', target: '1', opacity: 0.5 },
  { source: '4', target: '8', opacity: 0.6 },
  { source: '5', target: '10', opacity: 0.2 },
  { source: '6', target: '3', opacity: 0.3 },
  { source: '7', target: '9', opacity: 0.4 },
  { source: '8', target: '2', opacity: 0.5 },
  { source: '9', target: '3', opacity: 0.3 },
  { source: '10', target: '2', opacity: 0.4 },
];

export function NeuralMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // Initialize nodes with random positions
  useEffect(() => {
    const initialNodes: Node[] = MOCK_NODES.map((n, i) => ({
      ...n,
      id: n.id!,
      label: n.label!,
      platform: n.platform!,
      x: Math.random() * 800,
      y: Math.random() * 600,
      vx: 0,
      vy: 0,
      radius: 35 + Math.random() * 15,
    }));
    setNodes(initialNodes);
  }, []);

  // Force-directed simulation loop
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    const padding = 50;
    const gravity = 0.02;
    const repulsion = 100;
    const friction = 0.95;

    const step = () => {
      setNodes(prevNodes => {
        const nextNodes = prevNodes.map(node => ({ ...node }));
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;

        // Apply forces
        for (let i = 0; i < nextNodes.length; i++) {
          const a = nextNodes[i];

          // Gravity towards center
          a.vx += (width / 2 - a.x) * gravity;
          a.vy += (height / 2 - a.y) * gravity;

          for (let j = i + 1; j < nextNodes.length; j++) {
            const b = nextNodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Repulsion force
            const force = repulsion / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }

          // Move nodes
          a.x += a.vx;
          a.y += a.vy;
          a.vx *= friction;
          a.vy *= friction;

          // Boundary checks
          if (a.x < padding) a.x = padding;
          if (a.y < padding) a.y = padding;
          if (a.x > width - padding) a.x = width - padding;
          if (a.y > height - padding) a.y = height - padding;
        }

        return nextNodes;
      });

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes.length]);

  const activeEdges = useMemo(() => {
    if (!hoveredNode) return MOCK_EDGES;
    return MOCK_EDGES.filter(e => e.source === hoveredNode || e.target === hoveredNode);
  }, [hoveredNode]);

  return (
    <div className={styles.readinessContainer} style={{ height: 'calc(100vh - 120px)', position: 'relative', overflow: 'hidden' }}>
      <div className={styles.pageHeroBlock}>
        <h1 className={styles.pageHeroTitle}>Neural Map</h1>
        <p className={styles.pageHeroSub}>Visualizing the synaptic connections between your digital memories.</p>
      </div>

      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          width: '100%', 
          background: 'var(--bg-secondary)', 
          borderRadius: '32px',
          border: '1px solid var(--border-subtle)',
          position: 'relative',
          cursor: 'grab'
        }}
      >
        <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
          {/* Edges */}
          {activeEdges.map((edge, i) => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return null;

            const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;

            return (
              <line
                key={`edge-${i}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? 'var(--accent-terracotta)' : 'var(--text-muted)'}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isHighlighted ? 0.8 : edge.opacity}
                style={{ transition: 'stroke 0.3s ease, stroke-width 0.3s ease' }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <g 
              key={node.id} 
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Glow effect on hover */}
              {hoveredNode === node.id && (
                <circle
                  r={node.radius + 10}
                  fill={PLATFORM_COLORS[node.platform]}
                  opacity={0.15}
                  style={{ transition: 'all 0.3s ease' }}
                />
              )}
              
              {/* Outer Shell */}
              <circle
                r={node.radius}
                fill="var(--bg-card)"
                stroke={hoveredNode === node.id ? 'var(--accent-terracotta)' : 'var(--border-subtle)'}
                strokeWidth={2}
                style={{ transition: 'all 0.3s ease' }}
              />

              {/* Memory Text */}
              <text
                dy=".35em"
                textAnchor="middle"
                style={{ 
                  fontFamily: 'var(--font-sans)', 
                  fontSize: '11px', 
                  fontWeight: 600,
                  fill: 'var(--text-primary)',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              >
                {node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label}
              </text>

              {/* Platform Badge */}
              <circle
                cy={node.radius - 5}
                r={8}
                fill={PLATFORM_COLORS[node.platform]}
              />
            </g>
          ))}
        </svg>

        {/* Legend / Overlay */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'var(--bg-card)',
          backdropFilter: 'var(--glass-blur)',
          padding: '16px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
        }}>
          <p style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Active Dimensions</p>
          {Object.entries(PLATFORM_COLORS).map(([p, color]) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
