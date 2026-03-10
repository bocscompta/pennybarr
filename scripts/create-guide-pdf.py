#!/usr/bin/env python3
"""
Script to create the Pennybarr Electronic Invoicing Guide PDF
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, ListFlowable, ListItem
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.lib import colors

# Colors
TEAL = HexColor('#006666')
DARK = HexColor('#141A1F')
LIGHT_TEAL = HexColor('#E6F2F2')
GRAY = HexColor('#6C767F')

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

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=TEAL,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )

    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=DARK,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=TEAL,
        spaceBefore=20,
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )

    subheading_style = ParagraphStyle(
        'CustomSubheading',
        parent=styles['Heading3'],
        fontSize=14,
        textColor=DARK,
        spaceBefore=15,
        spaceAfter=8,
        fontName='Helvetica-Bold'
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        textColor=DARK,
        alignment=TA_JUSTIFY,
        spaceAfter=10,
        leading=16
    )

    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontSize=11,
        textColor=DARK,
        leftIndent=20,
        spaceAfter=6,
        leading=14
    )

    highlight_style = ParagraphStyle(
        'Highlight',
        parent=styles['Normal'],
        fontSize=11,
        textColor=TEAL,
        fontName='Helvetica-Bold',
        spaceAfter=10
    )

    # Build content
    story = []

    # ========== COVER PAGE ==========
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("pennybarr", ParagraphStyle('Logo', fontSize=36, textColor=TEAL, alignment=TA_CENTER, fontName='Helvetica-Bold')))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("— FACTURE ÉLECTRONIQUE —", ParagraphStyle('Tag', fontSize=12, textColor=GRAY, alignment=TA_CENTER)))
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("LE GUIDE", title_style))
    story.append(Paragraph("POUR TOUT COMPRENDRE ET<br/>PRÉPARER VOTRE TRANSITION !", subtitle_style))
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("Édition 2025", ParagraphStyle('Edition', fontSize=12, textColor=GRAY, alignment=TA_CENTER)))
    story.append(PageBreak())

    # ========== INTRODUCTION ==========
    story.append(Paragraph("Introduction", heading_style))
    story.append(Paragraph(
        "La facturation électronique devient progressivement obligatoire en France pour toutes les entreprises "
        "assujetties à la TVA. Cette réforme majeure vise à moderniser les échanges de factures entre entreprises "
        "grâce à des flux entièrement dématérialisés.",
        body_style
    ))
    story.append(Paragraph(
        "Ce guide vous accompagne pour comprendre les enjeux de cette réforme et vous préparer sereinement "
        "à cette transition avec Pennybarr, votre plateforme agréée (PA).",
        body_style
    ))
    story.append(Spacer(1, 1*cm))

    # ========== QUI EST CONCERNÉ ==========
    story.append(Paragraph("Qui est concerné ?", heading_style))
    story.append(Paragraph(
        "Toutes les entreprises françaises assujetties à la TVA sont concernées par cette réforme. "
        "Cela inclut :",
        body_style
    ))
    story.append(Paragraph("• Les grandes entreprises et ETI", bullet_style))
    story.append(Paragraph("• Les PME et TPE", bullet_style))
    story.append(Paragraph("• Les auto-entrepreneurs (même en franchise en base de TVA)", bullet_style))
    story.append(Paragraph("• Les professions libérales", bullet_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "Important : Les auto-entreprises en franchise en base, bien que non redevables de la TVA, "
        "restent assujetties et sont donc concernées par cette obligation.",
        highlight_style
    ))
    story.append(Spacer(1, 1*cm))

    # ========== CALENDRIER ==========
    story.append(Paragraph("Le calendrier de la réforme", heading_style))
    story.append(Paragraph(
        "La mise en place de la facturation électronique se fait progressivement selon le calendrier suivant :",
        body_style
    ))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Printemps 2025", subheading_style))
    story.append(Paragraph(
        "Possibilité de désigner Pennybarr en qualité de PA à partir de votre espace client, "
        "en conformité avec les exigences de l'administration.",
        body_style
    ))

    story.append(Paragraph("Été 2025", subheading_style))
    story.append(Paragraph(
        "Ouverture de l'annuaire du gouvernement et début de la phase pilote avec la DGFiP. "
        "Cette phase vous permettra de vous familiariser avec Pennybarr comme PA.",
        body_style
    ))

    story.append(Paragraph("Septembre 2026", subheading_style))
    story.append(Paragraph(
        "• Obligation d'émission ET de réception pour les grandes entreprises et ETI<br/>"
        "• Obligation de réception uniquement pour les TPE/PME et indépendants",
        body_style
    ))

    story.append(Paragraph("Septembre 2027", subheading_style))
    story.append(Paragraph(
        "Obligation d'émission des factures électroniques pour toutes les TPE/PME et indépendants.",
        body_style
    ))
    story.append(PageBreak())

    # ========== QU'EST-CE QU'UNE PA ==========
    story.append(Paragraph("Qu'est-ce qu'une PA ?", heading_style))
    story.append(Paragraph(
        "Une PA (Plateforme Agréée, anciennement PDP - Plateforme de Dématérialisation Partenaire) "
        "est un intermédiaire certifié par l'État qui assure :",
        body_style
    ))
    story.append(Paragraph("• La transmission sécurisée de factures électroniques entre fournisseurs et clients", bullet_style))
    story.append(Paragraph("• La conformité des factures aux normes en vigueur", bullet_style))
    story.append(Paragraph("• La bonne réception des factures chez vos clients", bullet_style))
    story.append(Paragraph("• La circulation des informations entre tous les acteurs", bullet_style))
    story.append(Paragraph("• La transmission des données à l'administration fiscale (e-reporting)", bullet_style))
    story.append(Spacer(1, 1*cm))

    # ========== POURQUOI PENNYBARR ==========
    story.append(Paragraph("Pourquoi choisir Pennybarr comme PA ?", heading_style))

    story.append(Paragraph("Déjà prête et opérationnelle", subheading_style))
    story.append(Paragraph(
        "Pennybarr est déjà certifiée et opérationnelle. En nous choisissant dès maintenant, "
        "vous n'aurez plus à vous en préoccuper le moment venu.",
        body_style
    ))

    story.append(Paragraph("Solution tout-en-un unique", subheading_style))
    story.append(Paragraph(
        "Pennybarr est la seule solution du marché qui rassemble votre comptabilité, votre gestion "
        "financière, votre compte pro et votre PA dans une seule interface.",
        body_style
    ))

    story.append(Paragraph("Centralisation des factures", subheading_style))
    story.append(Paragraph(
        "Toutes vos factures fournisseurs apparaîtront automatiquement dans votre boîte de réception "
        "Pennybarr, prêtes à être traitées et comptabilisées.",
        body_style
    ))

    story.append(Paragraph("Certification et sécurité", subheading_style))
    story.append(Paragraph(
        "Pennybarr bénéficie de la certification ISO 27001, garantissant la sécurité de vos données "
        "et la conformité de nos processus.",
        body_style
    ))
    story.append(PageBreak())

    # ========== L'ANNUAIRE ==========
    story.append(Paragraph("L'annuaire du gouvernement", heading_style))
    story.append(Paragraph(
        "Pour permettre le routage électronique des factures, l'administration met en place un "
        "annuaire gouvernemental (Annuaire PPF) qui permet de :",
        body_style
    ))
    story.append(Paragraph("• Lister toutes les entreprises assujetties à la TVA", bullet_style))
    story.append(Paragraph("• Identifier les PA mandatées par chaque entreprise", bullet_style))
    story.append(Paragraph("• Router automatiquement les factures vers la bonne destination", bullet_style))
    story.append(Spacer(1, 1*cm))

    # ========== DÉSIGNER UNE PA ==========
    story.append(Paragraph("Comment désigner une PA ?", heading_style))
    story.append(Paragraph(
        "Désigner une plateforme comme PA (en réception, émission ou les deux) est une démarche "
        "administrative et fiscale importante.",
        body_style
    ))
    story.append(Paragraph(
        "La PA doit être désignée via le formulaire officiel par :",
        body_style
    ))
    story.append(Paragraph("• Le représentant légal de l'entreprise", bullet_style))
    story.append(Paragraph("• Ou toute personne ayant le pouvoir d'engager l'entreprise (mandat régulier)", bullet_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "Avec Pennybarr, la désignation se fait simplement depuis votre espace client, "
        "et nous nous chargeons des démarches administratives.",
        highlight_style
    ))
    story.append(Spacer(1, 1*cm))

    # ========== CHANGER DE PA ==========
    story.append(Paragraph("Peut-on changer de PA ?", heading_style))
    story.append(Paragraph(
        "Oui, vous restez libre de changer de PA à tout moment. Il vous faudra :",
        body_style
    ))
    story.append(Paragraph("• Donner un mandat explicite à votre nouvelle PA", bullet_style))
    story.append(Paragraph("• La nouvelle PA se chargera de la mise à jour dans l'annuaire", bullet_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "Attention : Un changement de PA implique de revoir vos processus de facturation, "
        "potentiellement gérer plusieurs interfaces et peut engendrer des coûts additionnels.",
        body_style
    ))
    story.append(PageBreak())

    # ========== FORMATS ==========
    story.append(Paragraph("Les formats de factures acceptés", heading_style))
    story.append(Paragraph(
        "La réforme impose l'utilisation de formats structurés pour les factures électroniques :",
        body_style
    ))

    story.append(Paragraph("Factur-X", subheading_style))
    story.append(Paragraph(
        "Format hybride combinant un PDF lisible par l'humain et des données XML structurées. "
        "C'est le format le plus répandu en France.",
        body_style
    ))

    story.append(Paragraph("UBL (Universal Business Language)", subheading_style))
    story.append(Paragraph(
        "Format XML standardisé au niveau international, utilisé notamment pour les échanges "
        "transfrontaliers.",
        body_style
    ))

    story.append(Paragraph("CII (Cross Industry Invoice)", subheading_style))
    story.append(Paragraph(
        "Format XML basé sur la norme UN/CEFACT, également reconnu au niveau européen.",
        body_style
    ))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "Pennybarr génère automatiquement vos factures au format Factur-X conforme, "
        "sans action de votre part.",
        highlight_style
    ))
    story.append(Spacer(1, 1*cm))

    # ========== E-REPORTING ==========
    story.append(Paragraph("L'e-reporting", heading_style))
    story.append(Paragraph(
        "En plus de la facturation électronique (e-invoicing), la réforme introduit l'e-reporting : "
        "la transmission de données de transaction à l'administration fiscale.",
        body_style
    ))
    story.append(Paragraph(
        "L'e-reporting concerne :",
        body_style
    ))
    story.append(Paragraph("• Les transactions avec des particuliers (B2C)", bullet_style))
    story.append(Paragraph("• Les transactions avec des entreprises étrangères", bullet_style))
    story.append(Paragraph("• Les données de paiement", bullet_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "Pennybarr gère automatiquement l'e-reporting pour vous, en transmettant les données "
        "requises à l'administration dans les délais impartis.",
        highlight_style
    ))
    story.append(PageBreak())

    # ========== COMMENT SE PRÉPARER ==========
    story.append(Paragraph("Comment se préparer ?", heading_style))

    story.append(Paragraph("1. Choisissez votre PA dès maintenant", subheading_style))
    story.append(Paragraph(
        "N'attendez pas la dernière minute. En choisissant Pennybarr comme PA dès aujourd'hui, "
        "vous vous assurez une transition sereine.",
        body_style
    ))

    story.append(Paragraph("2. Mettez à jour vos données", subheading_style))
    story.append(Paragraph(
        "Vérifiez que les informations de votre entreprise (SIREN, adresse, etc.) sont à jour "
        "dans votre espace Pennybarr.",
        body_style
    ))

    story.append(Paragraph("3. Informez vos partenaires", subheading_style))
    story.append(Paragraph(
        "Communiquez à vos clients et fournisseurs que vous utilisez Pennybarr comme PA "
        "pour faciliter les échanges.",
        body_style
    ))

    story.append(Paragraph("4. Formez vos équipes", subheading_style))
    story.append(Paragraph(
        "Assurez-vous que vos collaborateurs comprennent les nouveaux processus de facturation "
        "et savent utiliser Pennybarr.",
        body_style
    ))
    story.append(Spacer(1, 1*cm))

    # ========== CONCLUSION ==========
    story.append(Paragraph("Conclusion", heading_style))
    story.append(Paragraph(
        "La réforme de la facturation électronique représente un changement majeur pour toutes "
        "les entreprises françaises. Avec Pennybarr, vous bénéficiez d'une solution complète, "
        "certifiée et déjà opérationnelle pour aborder cette transition en toute sérénité.",
        body_style
    ))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(
        "Des questions ? Notre équipe est à votre disposition pour vous accompagner.",
        body_style
    ))
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("www.pennybarr.com", ParagraphStyle('URL', fontSize=14, textColor=TEAL, alignment=TA_CENTER, fontName='Helvetica-Bold')))

    # Build PDF
    doc.build(story)
    print(f"PDF created: {output_path}")

if __name__ == "__main__":
    create_guide()
