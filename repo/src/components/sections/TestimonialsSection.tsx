"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { ANIMATION } from "@/lib/constants";
import { SectionTorches } from "@/components/ui/TheatreDecorations";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Audience Member, Swaranirmiti 2024",
    quote:
      "The production quality was extraordinary. It felt like attending a show in Mumbai's finest theatres, right here in Melbourne.",
    rating: 5,
  },
  {
    name: "Rajesh Patil",
    role: "Community Leader, Marathi Mandal",
    quote:
      "AB Entertainment consistently delivers cultural experiences that bridge generations with elegance and warmth.",
    rating: 5,
  },
  {
    name: "Dr. Meera Joshi",
    role: "Patron since 2012",
    quote:
      "The attention to detail - from venue selection to sound design - sets AB Entertainment apart from every other organizer in Australia.",
    rating: 5,
  },
  {
    name: "Vikram Deshmukh",
    role: "SBI Australia, Title Sponsor",
    quote:
      "Partnering with AB Entertainment gives our brand premium cultural visibility with an engaged and discerning community.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden bg-charcoal py-24 md:py-32" aria-label="Audience testimonials">
      <SectionTorches id="testimonials" variant="dark" />
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 font-display text-4xl text-ivory md:text-5xl"
        >
          What our audience <span className="text-gold">remembers.</span>
        </motion.h2>

        <div className="relative mt-16 min-h-[280px]">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              animate={{
                opacity: index === activeIndex ? 1 : 0,
                y: index === activeIndex ? 0 : 20,
                scale: index === activeIndex ? 1 : 0.95,
              }}
              transition={{ duration: 0.8, ease: ANIMATION.ease.luxury }}
              className="absolute inset-0 flex flex-col items-center"
            >
              <Quote className="h-10 w-10 text-gold/65" />
              <p className="mt-8 max-w-3xl font-display text-2xl leading-relaxed text-ivory md:text-3xl">
                {testimonial.quote}
              </p>
              <div className="mt-8 flex items-center gap-1.5 text-gold">
                {Array.from({ length: testimonial.rating }).map((_, starIndex) => (
                  <Star key={`${testimonial.name}-${starIndex}`} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-5 font-display text-xl text-gold">{testimonial.name}</p>
              <p className="mt-1 font-body text-xs uppercase tracking-[0.24em] text-ivory/60">{testimonial.role}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
