"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Registro único de plugins — DESIGN_SYSTEM.md §1.8. Este módulo es el único lugar que lo hace.
gsap.registerPlugin(useGSAP, ScrollTrigger, Flip);

export { gsap, ScrollTrigger, Flip, useGSAP };
