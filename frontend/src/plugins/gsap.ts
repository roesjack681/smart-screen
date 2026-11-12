import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power2.out', duration: 0.6 });
gsap.config({ nullTargetWarn: false });

const gsapMatchMedia = gsap.matchMedia();

export { gsap, ScrollTrigger, gsapMatchMedia };
