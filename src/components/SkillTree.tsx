'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Code2, Brain, Globe, Database, Terminal, Server, Cpu, Box, Cloud, Layers, Bot, LayoutTemplate } from 'lucide-react';
import { resumeData } from '@/data/resume';

const categoryIcons = {
  programming: Code2,
  ai: Brain,
  web: Globe,
  databases: Database
};

const skillIcons: Record<string, any> = {
  "Python": Terminal,
  "Golang": Server,
  "ReactJS": Box,
  "Next.js": Layers,
  "TailwindCSS": LayoutTemplate,
  "Docker": Box,
  "Kubernetes": Cloud,
  "PostgreSQL": Database,
  "MongoDB": Database,
  "Langchain": Bot,
  "OpenAI GPT-4": Brain,
  "Hugging Face": Bot,
  "AWS ECS": Cloud,
};

// SVG Paths for tech-style branches
const branches = [
  // AI (Left)
  { path: "M 500 200 L 400 200 L 300 300 L 250 300", category: "ai", x: 250, y: 300, align: 'left' },
  // Programming (Right)
  { path: "M 500 400 L 600 400 L 700 500 L 750 500", category: "programming", x: 750, y: 500, align: 'right' },
  // Web (Left)
  { path: "M 500 700 L 400 700 L 300 800 L 250 800", category: "web", x: 250, y: 800, align: 'left' },
  // Databases (Right)
  { path: "M 500 900 L 600 900 L 700 1000 L 750 1000", category: "databases", x: 750, y: 1000, align: 'right' },
];

export default function SkillTree() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Calculate trunk growth
  const trunkLength = useTransform(smoothProgress, [0, 1], [0, 1200]);

  return (
    <div ref={containerRef} className="relative w-full max-w-4xl mx-auto h-[800px] md:h-[1200px] my-16 md:my-32">
      
      {/* Background SVG for the Tree Structure */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1200" preserveAspectRatio="xMidYMin meet">
        {/* Main Trunk */}
        <motion.line 
          x1="500" y1="0" 
          x2="500" y2={trunkLength} 
          stroke="rgba(255,122,0,0.4)" 
          strokeWidth="3" 
          strokeLinecap="round" 
        />
        
        {/* Branches */}
        {branches.map((branch, i) => {
          const startProgress = (parseInt(branch.path.split(' ')[2]) / 1200);
          const endProgress = startProgress + 0.15;
          const pathLength = useTransform(smoothProgress, [startProgress, endProgress], [0, 1]);

          return (
            <motion.path
              key={i}
              d={branch.path}
              fill="transparent"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="2"
              style={{ pathLength }}
            />
          );
        })}
      </svg>

      {/* Nodes (Leaves) */}
      {branches.map((branch, i) => {
        const startProgress = (parseInt(branch.path.split(' ')[2]) / 1200);
        const iconProgress = startProgress + 0.15;
        
        const opacity = useTransform(smoothProgress, [iconProgress, iconProgress + 0.05], [0, 1]);
        const scale = useTransform(smoothProgress, [iconProgress, iconProgress + 0.05], [0, 1]);

        const CategoryIcon = categoryIcons[branch.category as keyof typeof categoryIcons];
        const skills = resumeData.skills[branch.category as keyof typeof resumeData.skills];

        return (
          <motion.div
            key={i}
            className={`absolute flex flex-col items-center z-10`}
            style={{ 
              top: `${(branch.y / 1200) * 100}%`, 
              left: `${(branch.x / 1000) * 100}%`,
              x: '-50%',
              y: '-50%',
              opacity,
              scale
            }}
          >
            {/* The Node Category Icon */}
            <div className={`relative flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#151515] border border-[#ff7a00] shadow-[0_0_20px_rgba(255,122,0,0.2)] z-20`}>
              <CategoryIcon className="w-5 h-5 md:w-7 md:h-7 text-white" />
            </div>

            {/* The Skill Leaves in an orbit */}
            <div className={`absolute top-1/2 left-1/2 w-0 h-0 z-10 group/skills`}>
              {skills.map((skill, idx) => {
                const SkillIcon = skillIcons[skill] || Bot;
                
                // Orbit math: spread over an arc away from the trunk
                const spread = Math.PI * 0.9; // 162 degrees arc
                const startAngle = branch.align === 'left' ? (Math.PI - spread/2) : (-spread/2);
                const angle = startAngle + (spread * (idx / Math.max(1, skills.length - 1)));
                
                const radius = 65; // Orbit radius
                const xOffset = Math.cos(angle) * radius;
                const yOffset = Math.sin(angle) * radius;
                
                // Stagger the animation sequentially after the node pops
                const leafStart = iconProgress + 0.02 + (idx * 0.01);
                const leafOpacity = useTransform(smoothProgress, [leafStart, leafStart + 0.02], [0, 1]);
                const leafScale = useTransform(smoothProgress, [leafStart, leafStart + 0.02], [0.5, 1]);
                
                return (
                  <motion.div 
                    key={idx} 
                    className="absolute w-8 h-8 md:w-10 md:h-10 bg-white/5 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center shadow-lg group/leaf cursor-crosshair
                               transition-[filter,background-color,border-color,z-index] duration-300
                               group-has-[:hover]/skills:!blur-[3px] group-has-[:hover]/skills:!opacity-40 group-has-[:hover]/skills:!scale-90
                               hover:!scale-[1.4] hover:!blur-none hover:!opacity-100 hover:!bg-[#151515] hover:!border-[#ff7a00] hover:!z-50"
                    style={{ 
                      opacity: leafOpacity, 
                      scale: leafScale, 
                      left: xOffset,
                      top: yOffset,
                      x: '-50%',
                      y: '-50%' 
                    }}
                  >
                    <SkillIcon className="w-4 h-4 md:w-5 md:h-5 text-slate-300 group-hover/leaf:text-[#ff7a00] transition-colors" />
                    
                    {/* Tooltip to see what the skill is on hover */}
                    <div className="absolute top-[125%] opacity-0 group-hover/leaf:opacity-100 bg-[#111] text-[#ff7a00] text-[10px] px-2 py-1 rounded border border-[#ff7a00]/30 font-bold tracking-wider pointer-events-none transition-opacity whitespace-nowrap shadow-[0_0_10px_rgba(255,122,0,0.2)]">
                      {skill}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
