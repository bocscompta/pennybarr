#!/usr/bin/env python3
"""
Script to create the complete Pennybarr Electronic Invoicing Guide PDF
Fixed: No word breaking, added visual tables
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon, Ellipse, Group
from reportlab.graphics import renderPDF

# Colors
TEAL = HexColor('#006666')
DARK = HexColor('#141A1F')
LIGHT_TEAL = HexColor('#E6F2F2')
GRAY = HexColor('#6C767F')
WHITE = HexColor('#FFFFFF')
LIGHT_GRAY = HexColor('#F5F5F5')
BG_COLOR = HexColor('#E8F0F0')

class EcosystemeDiagram(Flowable):
    """Custom flowable for the ecosystem diagram"""

    def __init__(self, width=480, height=420):
        Flowable.__init__(self)
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height

        # Background
        c.setFillColor(BG_COLOR)
        c.roundRect(0, 0, w, h, 10, fill=1, stroke=0)

        # Title
        c.setFillColor(DARK)
        c.setFont('Helvetica-Bold', 16)
        c.drawCentredString(w/2, h - 30, "L'écosystème intermédié")
        c.drawCentredString(w/2, h - 50, "et interconnecté de la réforme")

        # === TOP SECTION: PDP Zone ===
        # PDP Zone background
        c.setFillColor(WHITE)
        c.roundRect(100, h - 170, 300, 80, 15, fill=1, stroke=0)

        # PDP Zone label
        c.setFillColor(TEAL)
        c.setFont('Helvetica', 7)
        c.drawCentredString(250, h - 95, "PLATEFORMES DE DÉMATÉRIALISATION PARTENAIRES")

        # Emetteur box (left)
        c.setFillColor(TEAL)
        c.roundRect(20, h - 155, 70, 50, 20, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica', 6)
        c.drawCentredString(55, h - 125, "É M E T T E U R")
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(55, h - 138, "Fournisseur")

        # PDP circle (center)
        c.setFillColor(TEAL)
        c.circle(250, h - 130, 25, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 10)
        c.drawCentredString(250, h - 133, "PDP")

        # Annuaire icon (between PDP and Recepteur)
        c.setFillColor(TEAL)
        c.circle(340, h - 130, 18, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 14)
        c.drawCentredString(340, h - 134, "◎")

        # Recepteur box (right)
        c.setFillColor(WHITE)
        c.setStrokeColor(TEAL)
        c.setLineWidth(2)
        c.roundRect(380, h - 155, 80, 50, 20, fill=1, stroke=1)
        c.setFillColor(TEAL)
        c.setFont('Helvetica', 6)
        c.drawCentredString(420, h - 125, "R É C E P T E U R")
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(420, h - 138, "Acheteur")

        # Arrows and labels (top flow)
        c.setStrokeColor(GRAY)
        c.setLineWidth(1)

        # Arrow: Emetteur -> PDP
        c.line(95, h - 130, 220, h - 130)
        self._draw_arrow(c, 220, h - 130, 'right')
        c.setFillColor(GRAY)
        c.setFont('Helvetica', 7)
        c.drawCentredString(157, h - 118, "Flux de")
        c.drawCentredString(157, h - 128, "factures")
        c.drawCentredString(157, h - 155, "Données des")
        c.drawCentredString(157, h - 165, "transactions")

        # Arrow: PDP -> Annuaire
        c.line(278, h - 130, 318, h - 130)
        self._draw_arrow(c, 318, h - 130, 'right')
        c.drawCentredString(298, h - 118, "Flux de")
        c.drawCentredString(298, h - 128, "factures")

        # Arrow: Annuaire -> Recepteur
        c.line(360, h - 130, 375, h - 130)
        self._draw_arrow(c, 375, h - 130, 'right')
        c.drawCentredString(368, h - 118, "Flux de")
        c.drawCentredString(368, h - 106, "factures")

        # === BOTTOM SECTION: Acteurs Publics ===
        # Acteurs Publics zone background
        c.setFillColor(WHITE)
        c.roundRect(100, 30, 280, 180, 15, fill=1, stroke=0)

        # Acteurs Publics label
        c.setFillColor(DARK)
        c.setFont('Helvetica', 7)
        c.drawCentredString(240, 195, "A C T E U R S")
        c.drawCentredString(240, 185, "P U B L I C S")

        # Arrow: PDP -> down to Acteurs Publics
        c.setStrokeColor(GRAY)
        c.line(250, h - 158, 250, 210)
        self._draw_arrow(c, 250, 210, 'down')
        c.setFillColor(GRAY)
        c.setFont('Helvetica', 7)
        c.drawCentredString(290, h - 185, "Données des factures")
        c.drawCentredString(290, h - 195, "et des transactions")

        # Annuaire des entreprises box
        c.setFillColor(TEAL)
        c.roundRect(150, 145, 180, 35, 15, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(240, 167, "Annuaire des")
        c.drawCentredString(240, 155, "entreprises")

        # Concentrateur de données box
        c.setFillColor(TEAL)
        c.roundRect(150, 100, 180, 35, 15, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(240, 122, "Concentrateur")
        c.drawCentredString(240, 110, "de données")

        # Arrow: Concentrateur -> Administration
        c.setStrokeColor(GRAY)
        c.line(240, 97, 240, 80)
        self._draw_arrow(c, 240, 80, 'down')
        c.setFillColor(GRAY)
        c.setFont('Helvetica', 7)
        c.drawCentredString(300, 88, "Données des factures")
        c.drawCentredString(300, 78, "et des transactions")

        # Administration fiscale box
        c.setFillColor(TEAL)
        c.roundRect(150, 40, 180, 35, 15, fill=1, stroke=0)
        # Building icon placeholder
        c.setFillColor(HexColor('#004D4D'))
        c.roundRect(160, 48, 25, 20, 3, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica', 10)
        c.drawCentredString(172, 52, "🏛")
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(265, 62, "Administration")
        c.drawCentredString(265, 50, "fiscale")

    def _draw_arrow(self, c, x, y, direction='right'):
        """Draw an arrow head using path"""
        c.setFillColor(GRAY)
        p = c.beginPath()
        if direction == 'right':
            p.moveTo(x, y)
            p.lineTo(x-6, y+4)
            p.lineTo(x-6, y-4)
            p.close()
        elif direction == 'down':
            p.moveTo(x, y)
            p.lineTo(x-4, y+6)
            p.lineTo(x+4, y+6)
            p.close()
        c.drawPath(p, fill=1, stroke=0)

def create_styles():
    styles = getSampleStyleSheet()

    # Cover title
    styles.add(ParagraphStyle(
        'CoverTitle',
        fontSize=42,
        textColor=TEAL,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        leading=50
    ))

    # Cover subtitle
    styles.add(ParagraphStyle(
        'CoverSubtitle',
        fontSize=18,
        textColor=DARK,
        alignment=TA_CENTER,
        fontName='Helvetica',
        leading=24
    ))

    # Chapter title (single line, no breaking)
    styles.add(ParagraphStyle(
        'ChapterTitle',
        fontSize=48,
        textColor=TEAL,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold',
        leading=56,
        spaceBefore=20
    ))

    # Chapter number
    styles.add(ParagraphStyle(
        'ChapterNum',
        fontSize=14,
        textColor=DARK,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold',
        spaceAfter=20
    ))

    # Section title
    styles.add(ParagraphStyle(
        'SectionTitle',
        fontSize=22,
        textColor=TEAL,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold',
        spaceBefore=25,
        spaceAfter=15,
        leading=28
    ))

    # Subsection title
    styles.add(ParagraphStyle(
        'SubsectionTitle',
        fontSize=14,
        textColor=DARK,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold',
        spaceBefore=18,
        spaceAfter=10,
        leading=20
    ))

    # Body text
    styles.add(ParagraphStyle(
        'CustomBody',
        fontSize=10,
        textColor=DARK,
        alignment=TA_JUSTIFY,
        fontName='Helvetica',
        spaceAfter=10,
        leading=14
    ))

    # Bullet point
    styles.add(ParagraphStyle(
        'CustomBullet',
        fontSize=10,
        textColor=DARK,
        alignment=TA_LEFT,
        fontName='Helvetica',
        leftIndent=15,
        spaceAfter=6,
        leading=14
    ))

    # Highlight/Important
    styles.add(ParagraphStyle(
        'CustomHighlight',
        fontSize=10,
        textColor=TEAL,
        alignment=TA_JUSTIFY,
        fontName='Helvetica-Bold',
        spaceAfter=10,
        leading=14
    ))

    # Editorial
    styles.add(ParagraphStyle(
        'Editorial',
        fontSize=11,
        textColor=DARK,
        alignment=TA_JUSTIFY,
        fontName='Helvetica-Oblique',
        spaceAfter=12,
        leading=16,
        leftIndent=15,
        rightIndent=15
    ))

    # TOC entry
    styles.add(ParagraphStyle(
        'TOCEntry',
        fontSize=10,
        textColor=DARK,
        alignment=TA_LEFT,
        fontName='Helvetica',
        spaceAfter=5,
        leading=13
    ))

    # TOC Chapter
    styles.add(ParagraphStyle(
        'TOCChapter',
        fontSize=12,
        textColor=TEAL,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold',
        spaceBefore=12,
        spaceAfter=6
    ))

    # Table cell style
    styles.add(ParagraphStyle(
        'TableCell',
        fontSize=9,
        textColor=DARK,
        alignment=TA_LEFT,
        fontName='Helvetica',
        leading=12
    ))

    # Table header
    styles.add(ParagraphStyle(
        'TableHeader',
        fontSize=9,
        textColor=WHITE,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        leading=12
    ))

    return styles

def create_guide():
    output_path = './public/Guide-Facture-Electronique-Pennybarr.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = create_styles()
    story = []

    # ==================== COVER PAGE ====================
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("pennybarr", ParagraphStyle('Logo', fontSize=36, textColor=TEAL, alignment=TA_CENTER, fontName='Helvetica-Bold')))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("— FACTURE ÉLECTRONIQUE —", ParagraphStyle('Tag', fontSize=11, textColor=GRAY, alignment=TA_CENTER)))
    story.append(Spacer(1, 2.5*cm))
    story.append(Paragraph("LE GUIDE", styles['CoverTitle']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("POUR TOUT COMPRENDRE ET", styles['CoverSubtitle']))
    story.append(Paragraph("PRÉPARER VOTRE TRANSITION !", styles['CoverSubtitle']))
    story.append(Spacer(1, 5*cm))
    story.append(Paragraph("Édition 2025", ParagraphStyle('Edition', fontSize=12, textColor=GRAY, alignment=TA_CENTER)))
    story.append(PageBreak())

    # ==================== EDITORIAL ====================
    story.append(Paragraph("ÉDITO", styles['ChapterTitle']))
    story.append(Spacer(1, 0.8*cm))
    story.append(Paragraph(
        "<b>Elle est l'un des sujets brûlants du moment au sein des sphères entrepreneuriale "
        "et comptable : la facture électronique !</b>",
        styles['Editorial']
    ))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "Bientôt obligatoire en France, la facturation électronique va transformer les habitudes des entreprises "
        "et des cabinets d'expertise comptable. Ce chamboulement vient avec son lot de défis, d'incertitudes mais "
        "aussi d'opportunités : modernisation et automatisation des processus des entreprises d'une part, et "
        "diversification des missions des experts-comptables d'autre part. Autant donc s'y préparer en amont "
        "pour aborder ces changements avec sérénité.",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "<b>Et en profiter pour améliorer votre productivité !</b>",
        styles['CustomHighlight']
    ))
    story.append(Paragraph(
        "C'est pour vous y aider que nous avons conçu ce guide : vous y trouverez les clés de lecture nécessaires "
        "à la bonne compréhension de la réforme et pourrez ainsi saisir tous les impacts de celle-ci sur votre "
        "quotidien ainsi que sur les relations entre entreprises et cabinets.",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "Nous vous partageons également tous nos conseils pratiques pour vous préparer efficacement et adopter "
        "sereinement la facture électronique.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.8*cm))
    story.append(Paragraph("Bonne lecture !", styles['CustomBody']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("<i>L'équipe Pennybarr</i>", ParagraphStyle('Signature', fontSize=11, textColor=TEAL, fontName='Helvetica-Oblique')))
    story.append(PageBreak())

    # ==================== TABLE OF CONTENTS ====================
    story.append(Paragraph("SOMMAIRE", styles['ChapterTitle']))
    story.append(Spacer(1, 0.8*cm))

    story.append(Paragraph("CHAPITRE 1 — INTRODUCTION", styles['TOCChapter']))
    story.append(Paragraph("Facture électronique : de quoi parle-t-on ?", styles['TOCEntry']))
    story.append(Paragraph("Zoom sur Factur-X", styles['TOCEntry']))

    story.append(Paragraph("CHAPITRE 2 — POURQUOI ?", styles['TOCChapter']))
    story.append(Paragraph("Comprendre la réforme de A à Z", styles['TOCEntry']))
    story.append(Paragraph("Origine et calendrier", styles['TOCEntry']))

    story.append(Paragraph("CHAPITRE 3 — CHANGEMENTS", styles['TOCChapter']))
    story.append(Paragraph("Qu'est-ce qui va (vraiment) changer ?", styles['TOCEntry']))
    story.append(Paragraph("Pour les entreprises", styles['TOCEntry']))
    story.append(Paragraph("Pour les cabinets d'expertise comptable", styles['TOCEntry']))
    story.append(Paragraph("Retour d'expérience international", styles['TOCEntry']))

    story.append(Paragraph("CHAPITRE 4 — TECHNOLOGIES", styles['TOCChapter']))
    story.append(Paragraph("Les différents types de plateformes", styles['TOCEntry']))
    story.append(Paragraph("Comment choisir votre PDP ?", styles['TOCEntry']))

    story.append(Paragraph("CHAPITRE 5 — TRANSITION", styles['TOCChapter']))
    story.append(Paragraph("Feuille de route pour une transition réussie", styles['TOCEntry']))
    story.append(Paragraph("Cabinets, comment accompagner vos clients ?", styles['TOCEntry']))
    story.append(Paragraph("La facturation électronique dans Pennybarr", styles['TOCEntry']))
    story.append(PageBreak())

    # ==================== CHAPTER 1: INTRODUCTION ====================
    story.append(Paragraph("CHAPITRE 1", styles['ChapterNum']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("INTRODUCTION", styles['ChapterTitle']))
    story.append(PageBreak())

    story.append(Paragraph("FACTURE ÉLECTRONIQUE : DE QUOI PARLE-T-ON ?", styles['SectionTitle']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "<b>La facture électronique n'est pas une simple facture dématérialisée, comme un PDF.</b>",
        styles['CustomHighlight']
    ))
    story.append(Paragraph(
        "Pour être considérée comme telle, une facture électronique doit respecter une norme précisée par "
        "l'administration fiscale et comporter un socle minimum de données structurées.",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "On parle donc ici de formats spécifiques tels que <b>UBL, CII ou Factur-X</b>. La facture électronique "
        "permet le traitement automatique et instantané des données par des systèmes informatiques : "
        "l'assurance d'une gestion fiable et fluide des données d'entreprise !",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.5*cm))

    # Table: Formats de facture électronique
    format_data = [
        [Paragraph("<b>Format</b>", styles['TableHeader']), Paragraph("<b>Description</b>", styles['TableHeader']), Paragraph("<b>Avantages</b>", styles['TableHeader'])],
        [Paragraph("UBL", styles['TableCell']), Paragraph("Universal Business Language - Format XML international", styles['TableCell']), Paragraph("Standard européen, interopérabilité", styles['TableCell'])],
        [Paragraph("CII", styles['TableCell']), Paragraph("Cross Industry Invoice - Format XML UN/CEFACT", styles['TableCell']), Paragraph("Reconnu internationalement", styles['TableCell'])],
        [Paragraph("Factur-X", styles['TableCell']), Paragraph("Format hybride : PDF lisible + XML structuré", styles['TableCell']), Paragraph("Le plus utilisé en France, pratique", styles['TableCell'])]
    ]
    format_table = Table(format_data, colWidths=[3*cm, 7*cm, 5*cm])
    format_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY])
    ]))
    story.append(format_table)
    story.append(Spacer(1, 0.8*cm))

    story.append(Paragraph("Zoom sur la Factur-X", styles['SubsectionTitle']))
    story.append(Paragraph(
        "Le format Factur-X est le format de facture électronique le plus plébiscité par les différents acteurs "
        "de la réforme. Il s'agit d'un <b>format hybride</b> : il comporte la facture au format PDF/A-3, lisible par "
        "l'humain, mais aussi un fichier structuré au format XML, lisible par la machine. Pratique !",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "Les données d'une facture Factur-X peuvent ainsi être exploitées instantanément. Nul besoin d'un outil "
        "de reconnaissance optique des caractères (OCR).",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "C'est une avancée de taille en matière de fiabilité des données, qui offre de nombreuses possibilités d'analyse.",
        styles['CustomHighlight']
    ))
    story.append(PageBreak())

    # ==================== CHAPTER 2: POURQUOI ? ====================
    story.append(Paragraph("CHAPITRE 2", styles['ChapterNum']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("POURQUOI ?", styles['ChapterTitle']))
    story.append(PageBreak())

    story.append(Paragraph("COMPRENDRE LA RÉFORME DE A À Z", styles['SectionTitle']))
    story.append(Paragraph(
        "La réforme qui introduit l'obligation de la facturation électronique est un projet de l'administration "
        "fiscale française visant à moderniser les échanges de factures entre les entreprises assujetties à la TVA, "
        "grâce à des flux dématérialisés de bout en bout.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Elle repose sur 2 piliers", styles['SubsectionTitle']))
    story.append(Spacer(1, 0.3*cm))

    # Table: Les 2 piliers
    piliers_data = [
        [Paragraph("<b>E-INVOICING</b>", styles['TableHeader']), Paragraph("<b>E-REPORTING</b>", styles['TableHeader'])],
        [Paragraph("<b>Facture Électronique</b>", styles['TableCell']), Paragraph("<b>Déclaration de données</b>", styles['TableCell'])],
        [Paragraph("Émission, transmission et réception de factures électroniques contenant un socle minimum de données structurées.", styles['TableCell']),
         Paragraph("Transmission à l'administration de certaines données de transactions et de paiement.", styles['TableCell'])],
        [Paragraph("<b>Concerne :</b> Tous les échanges B2B entre entreprises privées de droit français.", styles['TableCell']),
         Paragraph("<b>Concerne :</b> Échanges B2C (particuliers) ou internationaux (intracommunautaires, exports).", styles['TableCell'])]
    ]
    piliers_table = Table(piliers_data, colWidths=[7.5*cm, 7.5*cm])
    piliers_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT_TEAL),
        ('GRID', (0, 0), (-1, -1), 1, TEAL),
    ]))
    story.append(piliers_table)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(
        "<b>À noter !</b> Toutes les entreprises établies en France et assujetties à la TVA sont concernées par la réforme. "
        "Les auto-entrepreneurs en franchise en base sont donc aussi concernés : ils ne sont pas redevables, mais bien assujettis à la TVA !",
        styles['CustomHighlight']
    ))
    story.append(Spacer(1, 0.8*cm))

    story.append(Paragraph("Objectifs du Gouvernement", styles['SubsectionTitle']))
    story.append(Paragraph("En rendant la facturation électronique obligatoire, les objectifs sont multiples :", styles['CustomBody']))
    story.append(Paragraph("• <b>Renforcer la compétitivité des entreprises</b> grâce à l'allègement de la charge administrative", styles['CustomBullet']))
    story.append(Paragraph("• <b>Simplifier les obligations déclaratives en matière de TVA</b> grâce au pré-remplissage", styles['CustomBullet']))
    story.append(Paragraph("• <b>Améliorer la lutte contre la fraude fiscale</b>", styles['CustomBullet']))
    story.append(Paragraph("• <b>Améliorer la connaissance en temps réel de l'économie</b> des entreprises", styles['CustomBullet']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "L'État estime à 4,5 milliards d'euros par an les gains que les TPE et PME réaliseront à terme.",
        styles['CustomHighlight']
    ))
    story.append(PageBreak())

    story.append(Paragraph("ORIGINE ET CALENDRIER", styles['SectionTitle']))
    story.append(Paragraph(
        "Initialement, l'administration avait prévu une mise en œuvre obligatoire progressive entre 2024 et 2026. "
        "Afin de donner le temps nécessaire à la réussite de cette réforme structurante, un nouveau calendrier a été mis en place.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.5*cm))

    # Table: Calendrier
    calendrier_data = [
        [Paragraph("<b>Date</b>", styles['TableHeader']), Paragraph("<b>Étape</b>", styles['TableHeader']), Paragraph("<b>Qui est concerné ?</b>", styles['TableHeader'])],
        [Paragraph("<b>Mars 2025</b>", styles['TableCell']), Paragraph("Mise à disposition de l'annuaire", styles['TableCell']), Paragraph("Toutes les entreprises", styles['TableCell'])],
        [Paragraph("<b>S1 2025</b>", styles['TableCell']), Paragraph("Mini-pilote avec les premières PDP", styles['TableCell']), Paragraph("PDP immatriculées", styles['TableCell'])],
        [Paragraph("<b>S2 2025</b>", styles['TableCell']), Paragraph("Pilote en conditions réelles", styles['TableCell']), Paragraph("Acteurs volontaires", styles['TableCell'])],
        [Paragraph("<b>Sept. 2026</b>", styles['TableCell']), Paragraph("Obligation d'émission + réception pour tous", styles['TableCell']), Paragraph("Grandes entreprises, ETI + réception pour tous", styles['TableCell'])],
        [Paragraph("<b>Sept. 2027</b>", styles['TableCell']), Paragraph("Obligation d'émission pour tous", styles['TableCell']), Paragraph("TPE, PME, indépendants", styles['TableCell'])]
    ]
    calendrier_table = Table(calendrier_data, colWidths=[2.5*cm, 6*cm, 6.5*cm])
    calendrier_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY])
    ]))
    story.append(calendrier_table)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(
        "Ce décalage est l'opportunité parfaite pour vous préparer de manière efficace. Pennybarr, agréée "
        "Plateforme de Dématérialisation Partenaire, peut vous accompagner dans cette démarche.",
        styles['CustomHighlight']
    ))
    story.append(PageBreak())

    # ==================== CHAPTER 3: CHANGEMENTS ====================
    story.append(Paragraph("CHAPITRE 3", styles['ChapterNum']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("CHANGEMENTS", styles['ChapterTitle']))
    story.append(PageBreak())

    story.append(Paragraph("QU'EST-CE QUI VA (VRAIMENT) CHANGER ?", styles['SectionTitle']))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("Pour les entreprises", styles['SubsectionTitle']))
    story.append(Paragraph(
        "Première nouveauté : finie la transmission directe de factures entre le fournisseur et son client. "
        "Toutes les factures entre deux assujettis devront en effet passer par un ou plusieurs intermédiaires "
        "que sont la plateforme publique ou les plateformes privées.",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "Évidemment, cela ne change rien à la relation commerciale entre fournisseur et client : il restera "
        "possible d'échanger par mail, téléphone, ou courrier à propos d'une transaction.",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "Une fois concernée par l'obligation d'émission, une entreprise ne pourra plus créer une facture "
        "avec Word, Excel ou des carnets à souches. Elle aura besoin d'une solution technologique.",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "<b>Ces nouvelles habitudes, il faut les anticiper maintenant !</b>",
        styles['CustomHighlight']
    ))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Pour les cabinets d'expertise comptable", styles['SubsectionTitle']))
    story.append(Paragraph(
        "D'un point de vue technique, les cabinets vont rencontrer des enjeux d'intégration et d'interopérabilité "
        "avec la digitalisation progressive de leurs clients. L'arrivée de la facture électronique va automatiser "
        "une partie des missions portées jusqu'ici par les collaborateurs (saisie, lettrage, TVA).",
        styles['CustomBody']
    ))
    story.append(Paragraph(
        "Des gains de productivité substantiels qui vont permettre aux cabinets d'augmenter leur portefeuille "
        "clients, mais également de repenser leurs activités et la relation avec leurs clients.",
        styles['CustomHighlight']
    ))
    story.append(PageBreak())

    story.append(Paragraph("Retour d'expérience international", styles['SubsectionTitle']))
    story.append(Paragraph(
        "La France n'est pas le premier pays à rendre la facture électronique obligatoire. L'Amérique latine, "
        "et plus récemment l'Italie, sont pionniers dans l'adoption de ces modèles.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("Les 10 impacts positifs en Italie (selon Luca Pulli, RSM Italie)", styles['SubsectionTitle']))

    # Table: Impacts Italie
    impacts_data = [
        [Paragraph("<b>N°</b>", styles['TableHeader']), Paragraph("<b>Impact</b>", styles['TableHeader']), Paragraph("<b>Description</b>", styles['TableHeader'])],
        ["1", "Gain de temps", "Processus de création, d'envoi et d'archivage facilités"],
        ["2", "Économies", "Élimination des frais postaux et d'impression"],
        ["3", "Gain d'espace", "Stockage des factures papier réduit"],
        ["4", "Sécurité archivage", "Archivage conforme durant 10 ans"],
        ["5", "Simplicité", "Service immédiat et assistance continue"],
        ["6", "Sécurité données", "Données sensibles protégées"],
        ["7", "Mobilité", "Système accessible à distance"],
        ["8", "Réductions impôts", "Allégements fiscaux possibles"],
        ["9", "Contrôles simplifiés", "Contrôle des factures facile"],
        ["10", "Traçabilité", "Suivi simplifié des documents et paiements"]
    ]
    impacts_table = Table(impacts_data, colWidths=[1*cm, 3.5*cm, 10.5*cm])
    impacts_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY])
    ]))
    story.append(impacts_table)
    story.append(PageBreak())

    # ==================== CHAPTER 4: TECHNOLOGIES ====================
    story.append(Paragraph("CHAPITRE 4", styles['ChapterNum']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("TECHNOLOGIES", styles['ChapterTitle']))
    story.append(PageBreak())

    story.append(Paragraph("LES DIFFÉRENTS TYPES DE PLATEFORMES", styles['SectionTitle']))
    story.append(Paragraph(
        "Avec l'obligation d'émettre et de recevoir des factures électroniques, tous les flux passeront "
        "par des plateformes numériques, publiques ou privées. Entreprises et cabinets vont devoir s'équiper.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.5*cm))

    # Table: Comparaison des plateformes
    plateformes_data = [
        [Paragraph("<b>Type</b>", styles['TableHeader']), Paragraph("<b>PPF</b>", styles['TableHeader']), Paragraph("<b>PDP</b>", styles['TableHeader']), Paragraph("<b>OD</b>", styles['TableHeader'])],
        [Paragraph("<b>Nom complet</b>", styles['TableCell']),
         Paragraph("Portail Public de Facturation", styles['TableCell']),
         Paragraph("Plateforme de Dématérialisation Partenaire", styles['TableCell']),
         Paragraph("Opérateur de Dématérialisation", styles['TableCell'])],
        [Paragraph("<b>Nature</b>", styles['TableCell']),
         Paragraph("Publique (État)", styles['TableCell']),
         Paragraph("Privée (agréée)", styles['TableCell']),
         Paragraph("Privée (non agréée)", styles['TableCell'])],
        [Paragraph("<b>Immatriculation</b>", styles['TableCell']),
         Paragraph("N/A", styles['TableCell']),
         Paragraph("Obligatoire", styles['TableCell']),
         Paragraph("Non", styles['TableCell'])],
        [Paragraph("<b>Émission directe</b>", styles['TableCell']),
         Paragraph("Oui", styles['TableCell']),
         Paragraph("Oui", styles['TableCell']),
         Paragraph("Non (via PDP)", styles['TableCell'])],
        [Paragraph("<b>Réception directe</b>", styles['TableCell']),
         Paragraph("Oui", styles['TableCell']),
         Paragraph("Oui", styles['TableCell']),
         Paragraph("Non (via PDP)", styles['TableCell'])],
        [Paragraph("<b>Fonctionnalités</b>", styles['TableCell']),
         Paragraph("Basiques", styles['TableCell']),
         Paragraph("Avancées (gestion, compta...)", styles['TableCell']),
         Paragraph("Variables", styles['TableCell'])],
        [Paragraph("<b>Certification ISO</b>", styles['TableCell']),
         Paragraph("N/A", styles['TableCell']),
         Paragraph("ISO 27001 obligatoire", styles['TableCell']),
         Paragraph("Non obligatoire", styles['TableCell'])]
    ]
    plateformes_table = Table(plateformes_data, colWidths=[3*cm, 3.5*cm, 5*cm, 3.5*cm])
    plateformes_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('BACKGROUND', (0, 1), (0, -1), LIGHT_TEAL),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY])
    ]))
    story.append(plateformes_table)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(
        "Nous vous encourageons fortement à choisir une PDP pour recevoir et émettre vos factures électroniques.",
        styles['CustomHighlight']
    ))
    story.append(PageBreak())

    # Visual Ecosystem Diagram
    story.append(EcosystemeDiagram(width=480, height=380))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("COMMENT CHOISIR VOTRE PDP ?", styles['SectionTitle']))
    story.append(Paragraph("Voici les critères les plus importants à étudier :", styles['CustomBody']))
    story.append(Spacer(1, 0.3*cm))

    # Link to official list
    story.append(Paragraph(
        "<b>Liste officielle des plateformes agréées :</b><br/>"
        "<font color='#006666'>www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees</font>",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.5*cm))

    # Table: Critères de choix PDP
    criteres_data = [
        [Paragraph("<b>Critère</b>", styles['TableHeader']), Paragraph("<b>Questions à se poser</b>", styles['TableHeader'])],
        [Paragraph("<b>1. Immatriculation</b>", styles['TableCell']), Paragraph("L'éditeur est-il bien agréé ? Consultez la liste officielle sur impots.gouv.fr", styles['TableCell'])],
        [Paragraph("<b>2. Fonctionnalités</b>", styles['TableCell']), Paragraph("Quels gains de productivité ? Facturation ? Pré-comptabilité ? Production comptable ?", styles['TableCell'])],
        [Paragraph("<b>3. Sécurité</b>", styles['TableCell']), Paragraph("Comment sont structurées et protégées les données ? Certification ISO 27001 ?", styles['TableCell'])],
        [Paragraph("<b>4. Simplicité</b>", styles['TableCell']), Paragraph("La plateforme répond-elle simplement à vos besoins ? Demandez une démonstration !", styles['TableCell'])],
        [Paragraph("<b>5. Prix</b>", styles['TableCell']), Paragraph("Les fonctionnalités justifient-elles le prix ? (Pennybarr inclut la e-facture sans surcoût)", styles['TableCell'])]
    ]
    criteres_table = Table(criteres_data, colWidths=[3.5*cm, 11.5*cm])
    criteres_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY])
    ]))
    story.append(criteres_table)
    story.append(PageBreak())

    # ==================== CHAPTER 5: TRANSITION ====================
    story.append(Paragraph("CHAPITRE 5", styles['ChapterNum']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("TRANSITION", styles['ChapterTitle']))
    story.append(PageBreak())

    story.append(Paragraph("FEUILLE DE ROUTE POUR UNE TRANSITION RÉUSSIE", styles['SectionTitle']))
    story.append(Paragraph(
        "Afin que votre transition vers la facturation électronique se passe en douceur et vous apporte les "
        "gains de productivité promis, suivez ces étapes.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.5*cm))

    # Table: Feuille de route
    feuille_data = [
        [Paragraph("<b>Étape</b>", styles['TableHeader']), Paragraph("<b>Actions</b>", styles['TableHeader'])],
        [Paragraph("<b>1. Cartographiez vos flux</b>", styles['TableCell']),
         Paragraph("• Identifiez vos canaux de facturation<br/>• Volume de factures par mois/an<br/>• Répartition B2B, B2C, international", styles['TableCell'])],
        [Paragraph("<b>2. Analysez vos processus</b>", styles['TableCell']),
         Paragraph("• Cadre de facturation (intragroupe, auto-facturation...)<br/>• Processus de validation existants<br/>• Traitement et archivage comptable", styles['TableCell'])],
        [Paragraph("<b>3. Fixez vos objectifs</b>", styles['TableCell']),
         Paragraph("• Estimez le coût actuel de traitement<br/>• Comparez avec un traitement automatisé<br/>• Déterminez vos objectifs de gains", styles['TableCell'])],
        [Paragraph("<b>4. Choisissez votre PDP</b>", styles['TableCell']),
         Paragraph("• Évaluez les solutions du marché<br/>• Demandez des démonstrations<br/>• Vérifiez l'immatriculation", styles['TableCell'])],
        [Paragraph("<b>5. Formez vos équipes</b>", styles['TableCell']),
         Paragraph("• Accompagnez le changement<br/>• Testez en conditions réelles<br/>• Ajustez vos processus", styles['TableCell'])]
    ]
    feuille_table = Table(feuille_data, colWidths=[4.5*cm, 10.5*cm])
    feuille_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY])
    ]))
    story.append(feuille_table)
    story.append(PageBreak())

    story.append(Paragraph("CABINETS : COMMENT ACCOMPAGNER VOS CLIENTS ?", styles['SectionTitle']))
    story.append(Paragraph(
        "De par votre expertise, vos clients vont venir vers vous pour être épaulés dans cette transition. "
        "Ils ne choisiront pas une application sans vous consulter : à vous de devenir leur prescripteur !",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("• <b>Transmettez les informations importantes</b> — Commencez dès aujourd'hui à amener le sujet auprès de vos clients", styles['CustomBullet']))
    story.append(Paragraph("• <b>Recommandez le logiciel adapté</b> — Suivez la feuille de route avec chacun de vos clients", styles['CustomBullet']))
    story.append(Paragraph("• <b>Facilitez la collaboration</b> — Privilégiez des solutions avec accès temps réel aux données", styles['CustomBullet']))
    story.append(PageBreak())

    # ==================== CONCLUSION ====================
    story.append(Paragraph("CONCLUSION", styles['ChapterTitle']))
    story.append(Spacer(1, 0.8*cm))

    story.append(Paragraph("LA FACTURATION ÉLECTRONIQUE DANS PENNYBARR", styles['SectionTitle']))
    story.append(Paragraph(
        "La DGFIP a validé notre immatriculation comme Plateforme de Dématérialisation Partenaire, et confirme "
        "que nous sommes prêts pour les prochaines étapes de la mise en place de la facturation électronique.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.3*cm))

    # Table: Pennybarr en chiffres
    pennybarr_data = [
        [Paragraph("<b>Indicateur</b>", styles['TableHeader']), Paragraph("<b>Valeur</b>", styles['TableHeader'])],
        [Paragraph("Entreprises utilisant Factur-X", styles['TableCell']), Paragraph("<b>100%</b>", styles['TableCell'])],
        [Paragraph("Factur-X émises par mois", styles['TableCell']), Paragraph("<b>+400 000</b>", styles['TableCell'])],
        [Paragraph("Factur-X reçues et lues par mois", styles['TableCell']), Paragraph("<b>+150 000</b>", styles['TableCell'])],
        [Paragraph("Certification", styles['TableCell']), Paragraph("<b>ISO 27001</b>", styles['TableCell'])],
        [Paragraph("Statut PDP", styles['TableCell']), Paragraph("<b>Immatriculée</b>", styles['TableCell'])]
    ]
    pennybarr_table = Table(pennybarr_data, colWidths=[8*cm, 7*cm])
    pennybarr_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY])
    ]))
    story.append(pennybarr_table)
    story.append(Spacer(1, 0.8*cm))

    story.append(Paragraph(
        "Un conseil pour préparer l'arrivée de la facturation électronique obligatoire : <b>anticipez</b> pour en "
        "retirer tous les effets bénéfiques !",
        styles['CustomHighlight']
    ))
    story.append(Paragraph(
        "Soyez actif dès aujourd'hui dans votre recherche d'informations, dans la sélection de vos futurs outils, "
        "ainsi que dans l'adaptation de vos processus internes.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 1.5*cm))

    story.append(Paragraph(
        "<b>Pennybarr</b> est la première plateforme qui réunit logiciel de production pour les experts-comptables "
        "et outil de gestion financière pour leurs clients. Pennybarr centralise en temps réel tous les flux "
        "financiers des entreprises et fluidifie la collaboration entre les dirigeants et leur expert-comptable.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 0.8*cm))
    story.append(Paragraph("<b>Pennybarr est officiellement PDP.</b>", styles['CustomHighlight']))
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("www.pennybarr.com", ParagraphStyle('URL', fontSize=18, textColor=TEAL, alignment=TA_CENTER, fontName='Helvetica-Bold')))

    # Build PDF
    doc.build(story)
    print(f"PDF created successfully: {output_path}")

if __name__ == "__main__":
    create_guide()
